'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, Zap, ListFilter } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Ticket, BatchAnalysisResult, TimePeriod, AITicketFilters } from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

// Filter parameters that can be passed to fetch all filtered ticket IDs
export interface FilterParams {
  period?: TimePeriod;
  customFrom?: string;
  customTo?: string;
  stageIds?: number[];
  typeIds?: number[];
  search?: string;
  aiFilters?: Partial<AITicketFilters> & { selectedStageIds?: number[] };
}

interface AIAnalysisBatchModalProps {
  tickets: Ticket[];                    // Current page tickets
  filterParams?: FilterParams;          // Filters for "analyze all"
  totalFilteredCount?: number;          // Total matching filters (from pagination.total)
  onComplete?: (result: BatchAnalysisResult) => void;
}

type AnalysisState = 'idle' | 'fetching' | 'analyzing' | 'complete' | 'error' | 'cancelled';
type AnalysisMode = 'current_page' | 'all_filtered';

interface ProgressState {
  current: number;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number; // Already analyzed tickets that were skipped
  currentChunk: number;
  totalChunks: number;
  errors: Array<{ ticketId: number; error: string }>;
  startTime: number;
  chunkTimes: number[]; // Time taken for each chunk in ms
}

// Max tickets per API batch call
// Reduced to 2 to avoid 502/504 Gateway errors
// Each ticket does full analysis (2 Gemini calls), 2 tickets = 4 Gemini calls max
const CHUNK_SIZE = 2;

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function AIAnalysisBatchModal({
  tickets,
  filterParams,
  totalFilteredCount,
  onComplete,
}: AIAnalysisBatchModalProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AnalysisState>('idle');
  const [mode, setMode] = useState<AnalysisMode>('all_filtered');
  const [skipAnalyzed, setSkipAnalyzed] = useState(true); // Default: only analyze unanalyzed tickets
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    currentChunk: 0,
    totalChunks: 0,
    errors: [],
    startTime: 0,
    chunkTimes: [],
  });

  const abortRef = useRef(false);
  const isAnalyzingRef = useRef(false);
  // Ref to track timeout for state reset (prevents race condition on quick reopen)
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate estimated time remaining based on chunk processing times
  const getEstimatedTimeRemaining = useCallback(() => {
    if (progress.chunkTimes.length === 0 || progress.currentChunk >= progress.totalChunks) {
      return null;
    }

    // Calculate average time per chunk (use last 3 for accuracy)
    const recentTimes = progress.chunkTimes.slice(-3);
    const avgTimeMs = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;

    const remainingChunks = progress.totalChunks - progress.currentChunk;
    const estimatedMs = remainingChunks * avgTimeMs;

    return estimatedMs / 1000; // Convert to seconds
  }, [progress.chunkTimes, progress.currentChunk, progress.totalChunks]);

  // Get elapsed time
  const getElapsedTime = useCallback(() => {
    if (progress.startTime === 0) return 0;
    return (Date.now() - progress.startTime) / 1000;
  }, [progress.startTime]);

  // Get ticket count for display
  const getTicketCount = useCallback(() => {
    if (mode === 'all_filtered' && totalFilteredCount !== undefined) {
      return totalFilteredCount;
    }
    return tickets.length;
  }, [mode, totalFilteredCount, tickets.length]);

  // Process tickets using batch API
  const processTickets = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    abortRef.current = false;

    let ticketIds: number[] = [];

    // If analyzing all filtered, fetch ticket IDs first
    if (mode === 'all_filtered' && filterParams) {
      setState('fetching');
      try {
        const { ticketIds: fetchedIds, truncated } = await api.getFilteredTicketIds({
          period: filterParams.period,
          customFrom: filterParams.customFrom,
          customTo: filterParams.customTo,
          stageIds: filterParams.aiFilters?.selectedStageIds || filterParams.stageIds,
          typeIds: filterParams.typeIds,
          search: filterParams.search,
          aiUrgency: filterParams.aiFilters?.aiUrgency,
          aiCategory: filterParams.aiFilters?.aiCategory,
          aiSentiment: filterParams.aiFilters?.aiSentiment,
          aiSatisfaction: filterParams.aiFilters?.aiSatisfaction,
          aiIsResolved: filterParams.aiFilters?.aiIsResolved,
          aiAwaitingAnswer: filterParams.aiFilters?.awaitingAnswer,
          // Filter out already analyzed tickets on the backend when skipAnalyzed is true
          onlyUnanalyzed: skipAnalyzed,
        });
        ticketIds = fetchedIds;

        if (truncated) {
          console.warn('[Batch Modal] Ticket list was truncated due to size limit');
        }
      } catch (error) {
        console.error('[Batch Modal] Failed to fetch ticket IDs:', error);
        setState('error');
        isAnalyzingRef.current = false;
        return;
      }
    } else {
      // Use current page tickets
      ticketIds = tickets.map(t => t.id);
    }

    if (ticketIds.length === 0) {
      setState('complete');
      isAnalyzingRef.current = false;
      return;
    }

    // Chunk tickets for batch API calls
    const chunks = chunkArray(ticketIds, CHUNK_SIZE);
    const total = ticketIds.length;

    setProgress({
      current: 0,
      total,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      currentChunk: 0,
      totalChunks: chunks.length,
      errors: [],
      startTime: Date.now(),
      chunkTimes: [],
    });

    setState('analyzing');

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ ticketId: number; error: string }> = [];
    const chunkTimes: number[] = [];

    // Process chunks
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      if (abortRef.current) {
        setState('cancelled');
        break;
      }

      const chunk = chunks[chunkIndex];
      const chunkStartTime = Date.now();

      setProgress(prev => ({
        ...prev,
        currentChunk: chunkIndex,
      }));

      try {
        // Call batch API for this chunk
        const response = await api.analyzeBatchTickets({
          ticketIds: chunk,
          forceReanalyze: !skipAnalyzed, // If skipAnalyzed=true, don't force reanalyze
          language: locale || 'en',
        });

        const result = response.result;
        succeeded += result.succeeded;
        failed += result.failed;
        skipped += result.skipped || 0;

        if (result.errors && result.errors.length > 0) {
          errors.push(...result.errors);
        }
      } catch (error) {
        // If entire chunk fails, count all as failed
        failed += chunk.length;
        for (const ticketId of chunk) {
          errors.push({
            ticketId,
            error: error instanceof Error ? error.message : 'Chunk failed',
          });
        }
      }

      const chunkTime = Date.now() - chunkStartTime;
      chunkTimes.push(chunkTime);

      const processedSoFar = (chunkIndex + 1) * CHUNK_SIZE;

      setProgress(prev => ({
        ...prev,
        current: Math.min(processedSoFar, total),
        succeeded,
        failed,
        skipped,
        errors,
        currentChunk: chunkIndex + 1,
        chunkTimes: [...prev.chunkTimes, chunkTime],
      }));
    }

    if (!abortRef.current) {
      setState('complete');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['helpdesk-analyses'] });

      // Call onComplete callback
      const result: BatchAnalysisResult = {
        total,
        succeeded,
        failed,
        analyses: [], // Analyses are stored in DB
        errors,
      };
      onComplete?.(result);
    }

    isAnalyzingRef.current = false;
  }, [mode, filterParams, tickets, skipAnalyzed, locale, queryClient, onComplete]);

  const handleStartAnalysis = useCallback(() => {
    processTickets();
  }, [processTickets]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleClose = useCallback(() => {
    if (state === 'analyzing' || state === 'fetching') {
      abortRef.current = true;
    }
    setOpen(false);
    // Clear any existing timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    // Reset state after close animation
    resetTimeoutRef.current = setTimeout(() => {
      setState('idle');
      setMode('all_filtered');
      setProgress({
        current: 0,
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        currentChunk: 0,
        totalChunks: 0,
        errors: [],
        startTime: 0,
        chunkTimes: [],
      });
      setSkipAnalyzed(true);
      resetTimeoutRef.current = null;
    }, 300);
  }, [state]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      handleClose();
    } else {
      // Clear pending reset timeout when reopening quickly
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      setOpen(true);
    }
  }, [handleClose]);

  const ticketCount = getTicketCount();
  const currentPageCount = tickets.length;
  const hasMoreThanPage = totalFilteredCount !== undefined && totalFilteredCount > currentPageCount;
  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const estimatedTimeRemaining = getEstimatedTimeRemaining();
  const elapsedTime = getElapsedTime();

  // Estimate time based on ~0.8s per ticket with parallel processing
  const estimatedTotalSeconds = Math.ceil((mode === 'all_filtered' ? (totalFilteredCount || 0) : currentPageCount) * 0.8);

  // Update elapsed time display every second during analysis
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state === 'analyzing' || state === 'fetching') {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [state]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={ticketCount === 0}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {(helpdesk?.aiAnalysisResult as string) || 'AI Analysis Result'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {(helpdesk?.batchAnalysisTitle as string) || 'AI Batch Analysis'}
            </DialogTitle>
            <DialogDescription>
              {state === 'idle' && (
                (helpdesk?.batchAnalysisDescription as string) ||
                'Analyze tickets using AI to extract urgency, category, sentiment, and more.'
              )}
              {state === 'fetching' && (
                (helpdesk?.fetchingTickets as string) ||
                'Fetching ticket IDs...'
              )}
              {state === 'analyzing' && (
                (helpdesk?.batchAnalysisInProgress as string) ||
                'Analysis in progress...'
              )}
              {state === 'complete' && (
                (helpdesk?.batchAnalysisComplete as string) ||
                'Analysis complete!'
              )}
              {state === 'cancelled' && (
                (helpdesk?.batchAnalysisCancelled as string) ||
                'Analysis was cancelled.'
              )}
              {state === 'error' && (
                (helpdesk?.batchAnalysisError as string) ||
                'An error occurred during analysis.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Idle State */}
            {state === 'idle' && (
              <div className="space-y-4">
                {/* Mode Selection */}
                {hasMoreThanPage && (
                  <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                    <div className="text-sm font-medium">
                      {(helpdesk?.selectScope as string) || 'Select scope:'}
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'current_page'}
                          onChange={() => setMode('current_page')}
                          className="h-4 w-4 text-purple-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{(helpdesk?.currentPage as string) || 'Current page'}</div>
                          <div className="text-sm text-muted-foreground">
                            {currentPageCount} {(helpdesk?.tickets as string)?.toLowerCase() || 'tickets'}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'all_filtered'}
                          onChange={() => setMode('all_filtered')}
                          className="h-4 w-4 text-purple-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <ListFilter className="h-4 w-4" />
                            {(helpdesk?.allFiltered as string) || 'All filtered tickets'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {totalFilteredCount} {(helpdesk?.tickets as string)?.toLowerCase() || 'tickets'}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Ticket count if no mode selection */}
                {!hasMoreThanPage && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      {(helpdesk?.ticketsToAnalyze as string) || 'Tickets to analyze:'}
                    </div>
                    <div className="text-2xl font-bold">{currentPageCount}</div>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipAnalyzed}
                    onChange={(e) => setSkipAnalyzed(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">
                    {(helpdesk?.skipAlreadyAnalyzed as string) || 'Only analyze tickets without existing analysis'}
                  </span>
                </label>

                {(mode === 'all_filtered' ? (totalFilteredCount || 0) : currentPageCount) > 50 && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {(helpdesk?.largeBatchWarning as string) ||
                        'Large batch - analysis may take a while but will process in optimized chunks.'}
                    </span>
                  </div>
                )}

                {/* Estimated time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {(helpdesk?.estimatedTime as string) || 'Estimated time:'}{' '}
                    ~{formatTimeRemaining(estimatedTotalSeconds)}
                  </span>
                  <span className="text-xs">
                    ({Math.ceil((mode === 'all_filtered' ? (totalFilteredCount || 0) : currentPageCount) / CHUNK_SIZE)} {(helpdesk?.chunks as string) || 'chunks'})
                  </span>
                </div>
              </div>
            )}

            {/* Fetching State */}
            {state === 'fetching' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
                <div className="text-center text-sm text-muted-foreground">
                  {(helpdesk?.fetchingTicketIds as string) || 'Fetching ticket IDs...'}
                </div>
              </div>
            )}

            {/* Analyzing State */}
            {state === 'analyzing' && (
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{progress.current} / {progress.total}</span>
                    <span>{progressPercent}%</span>
                  </div>
                </div>

                {/* Current chunk info */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    <span className="text-sm">
                      {(helpdesk?.processingChunk as string) || 'Processing chunk'}{' '}
                      <span className="font-medium">{progress.currentChunk + 1}/{progress.totalChunks}</span>
                    </span>
                  </div>
                </div>

                {/* Time stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {(helpdesk?.elapsed as string) || 'Elapsed:'}{' '}
                      {formatTimeRemaining(elapsedTime)}
                    </span>
                  </div>
                  {estimatedTimeRemaining !== null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-4 w-4" />
                      <span>
                        {(helpdesk?.remaining as string) || 'Remaining:'}{' '}
                        ~{formatTimeRemaining(estimatedTimeRemaining)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live stats */}
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    {progress.succeeded}
                  </span>
                  <span className="text-red-600">
                    <XCircle className="h-4 w-4 inline mr-1" />
                    {progress.failed}
                  </span>
                  {progress.skipped > 0 && (
                    <span className="text-gray-500">
                      ⏭️ {progress.skipped} {(helpdesk?.skipped as string) || 'skipped'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Complete State */}
            {(state === 'complete' || state === 'cancelled') && (
              <div className="space-y-4">
                {/* Final progress bar */}
                <div className="space-y-2">
                  <Progress value={100} className="h-3" />
                  <div className="text-sm text-muted-foreground text-center">
                    {progress.current} / {progress.total} {state === 'cancelled' && '(cancelled)'}
                  </div>
                </div>

                {/* Results summary */}
                <div className={`grid gap-4 ${progress.skipped > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{progress.succeeded}</div>
                    <div className="text-sm text-muted-foreground">
                      {(helpdesk?.analyzed as string) || 'Analyzed'}
                    </div>
                  </div>
                  {progress.skipped > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 text-center">
                      <span className="text-2xl block mb-2">⏭️</span>
                      <div className="text-2xl font-bold text-gray-600">{progress.skipped}</div>
                      <div className="text-sm text-muted-foreground">
                        {(helpdesk?.skipped as string) || 'Skipped'}
                      </div>
                    </div>
                  )}
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                    <div className="text-sm text-muted-foreground">
                      {(helpdesk?.failed as string) || 'Failed'}
                    </div>
                  </div>
                </div>

                {/* Time summary */}
                <div className="text-sm text-muted-foreground text-center">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {(helpdesk?.totalTime as string) || 'Total time:'}{' '}
                  {formatTimeRemaining((Date.now() - progress.startTime) / 1000)}
                  {progress.total > 0 && (
                    <span className="ml-2">
                      (~{((Date.now() - progress.startTime) / 1000 / progress.total).toFixed(1)}s/{(helpdesk?.perTicket as string) || 'ticket'})
                    </span>
                  )}
                </div>

                {/* Error details */}
                {progress.errors.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2 text-red-600">
                      {(helpdesk?.errors as string) || 'Errors:'}
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-red-50 dark:bg-red-900/10 rounded-lg p-2">
                      {progress.errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          Ticket #{err.ticketId}: {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="flex flex-col items-center py-8">
                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                <div className="text-center text-sm text-muted-foreground">
                  {(helpdesk?.analysisErrorMessage as string) || 'Failed to analyze tickets'}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {state === 'idle' && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  {(t.common.cancel as string) || 'Cancel'}
                </Button>
                <Button
                  onClick={handleStartAnalysis}
                  disabled={(mode === 'all_filtered' ? (totalFilteredCount || 0) : currentPageCount) === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {(helpdesk?.startAnalysis as string) || 'Start Analysis'}
                </Button>
              </>
            )}

            {(state === 'analyzing' || state === 'fetching') && (
              <Button variant="outline" onClick={handleCancel}>
                {(t.common.cancel as string) || 'Cancel'}
              </Button>
            )}

            {(state === 'complete' || state === 'cancelled' || state === 'error') && (
              <Button onClick={handleClose}>
                {((t.common as Record<string, string>)?.close) || 'Close'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
