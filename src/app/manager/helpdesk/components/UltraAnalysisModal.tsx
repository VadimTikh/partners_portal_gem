'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  FileText,
  BarChart3,
  ListTodo,
  ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import {
  UltraAnalysisReport,
  AICategory,
  TimePeriod,
  AITicketFilters,
} from '@/lib/types/helpdesk';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

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

interface UltraAnalysisModalProps {
  filterParams?: FilterParams;
  totalFilteredCount?: number;
  onComplete?: (report: UltraAnalysisReport) => void;
}

type AnalysisState =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error';

interface ProgressState {
  phase: 'fetching' | 'analyzing' | 'generating';
  current: number;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentChunk: number;
  totalChunks: number;
  startTime: number;
  chunkTimes: number[];
}

// Max tickets per API batch call
// Reduced from 50 to 5 to avoid 504 Gateway Timeout errors
// Each ticket does full analysis (2 Gemini calls), smaller chunks complete in ~10-15 seconds
const CHUNK_SIZE = 5;

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

// Category display names
const categoryDisplayNames: Record<AICategory, string> = {
  missing_dates: 'Missing Dates',
  refund_request: 'Refund Request',
  voucher_not_received: 'Voucher Not Received',
  voucher_expired: 'Voucher Expired',
  booking_change: 'Booking Change',
  complaint: 'Complaint',
  general_inquiry: 'General Inquiry',
  partner_issue: 'Partner Issue',
  payment_issue: 'Payment Issue',
  technical_issue: 'Technical Issue',
  other: 'Other',
};

// Severity colors
const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const severityBadgeVariants = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
} as const;

export function UltraAnalysisModal({
  filterParams,
  totalFilteredCount,
  onComplete,
}: UltraAnalysisModalProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AnalysisState>('idle');
  const [report, setReport] = useState<UltraAnalysisReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'fetching',
    current: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    currentChunk: 0,
    totalChunks: 0,
    startTime: 0,
    chunkTimes: [],
  });

  const abortRef = useRef(false);
  const isAnalyzingRef = useRef(false);

  // Get elapsed time
  const getElapsedTime = useCallback(() => {
    if (progress.startTime === 0) return 0;
    return (Date.now() - progress.startTime) / 1000;
  }, [progress.startTime]);

  // Calculate estimated time remaining based on chunk processing times
  const getEstimatedTimeRemaining = useCallback(() => {
    if (
      progress.phase !== 'analyzing' ||
      progress.chunkTimes.length === 0 ||
      progress.currentChunk >= progress.totalChunks
    ) {
      return null;
    }

    const recentTimes = progress.chunkTimes.slice(-3);
    const avgTimeMs =
      recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    const remainingChunks = progress.totalChunks - progress.currentChunk;
    const estimatedMs = remainingChunks * avgTimeMs;

    return estimatedMs / 1000;
  }, [
    progress.phase,
    progress.chunkTimes,
    progress.currentChunk,
    progress.totalChunks,
  ]);

  // Process tickets
  const processTickets = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    abortRef.current = false;

    setProgress({
      phase: 'fetching',
      current: 0,
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      currentChunk: 0,
      totalChunks: 0,
      startTime: Date.now(),
      chunkTimes: [],
    });

    // Step 1: Fetch all ticket IDs
    setState('fetching');
    let ticketIds: number[] = [];

    try {
      const { ticketIds: fetchedIds } = await api.getFilteredTicketIds({
        period: filterParams?.period,
        customFrom: filterParams?.customFrom,
        customTo: filterParams?.customTo,
        stageIds:
          filterParams?.aiFilters?.selectedStageIds || filterParams?.stageIds,
        typeIds: filterParams?.typeIds,
        search: filterParams?.search,
        aiUrgency: filterParams?.aiFilters?.aiUrgency,
        aiCategory: filterParams?.aiFilters?.aiCategory,
        aiSentiment: filterParams?.aiFilters?.aiSentiment,
        aiSatisfaction: filterParams?.aiFilters?.aiSatisfaction,
        aiIsResolved: filterParams?.aiFilters?.aiIsResolved,
        aiAwaitingAnswer: filterParams?.aiFilters?.awaitingAnswer,
      });
      ticketIds = fetchedIds;
    } catch (error) {
      console.error('[Ultra Analysis] Failed to fetch ticket IDs:', error);
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to fetch tickets'
      );
      isAnalyzingRef.current = false;
      return;
    }

    if (ticketIds.length === 0) {
      setState('error');
      setErrorMessage('No tickets found matching the current filters');
      isAnalyzingRef.current = false;
      return;
    }

    // Step 2: Batch analyze tickets that don't have analysis
    setState('analyzing');
    const chunks = chunkArray(ticketIds, CHUNK_SIZE);

    setProgress((prev) => ({
      ...prev,
      phase: 'analyzing',
      total: ticketIds.length,
      totalChunks: chunks.length,
    }));

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      if (abortRef.current) {
        setState('idle');
        isAnalyzingRef.current = false;
        return;
      }

      const chunk = chunks[chunkIndex];
      const chunkStartTime = Date.now();

      setProgress((prev) => ({
        ...prev,
        currentChunk: chunkIndex,
      }));

      try {
        const response = await api.analyzeBatchTickets({
          ticketIds: chunk,
          forceReanalyze: false, // Don't force reanalyze, use existing
          language: locale || 'en',
        });

        const result = response.result;
        succeeded += result.succeeded;
        failed += result.failed;
        skipped += result.skipped || 0;
      } catch (error) {
        failed += chunk.length;
        console.error('[Ultra Analysis] Chunk failed:', error);
      }

      const chunkTime = Date.now() - chunkStartTime;
      const processedSoFar = Math.min(
        (chunkIndex + 1) * CHUNK_SIZE,
        ticketIds.length
      );

      setProgress((prev) => ({
        ...prev,
        current: processedSoFar,
        succeeded,
        failed,
        skipped,
        currentChunk: chunkIndex + 1,
        chunkTimes: [...prev.chunkTimes, chunkTime],
      }));
    }

    // Step 3: Generate Ultra Report
    setState('generating');
    setProgress((prev) => ({
      ...prev,
      phase: 'generating',
    }));

    try {
      // Calculate period from filter params
      let period: { from: string; to: string } | undefined;
      if (filterParams?.customFrom && filterParams?.customTo) {
        period = {
          from: filterParams.customFrom,
          to: filterParams.customTo,
        };
      }

      const response = await api.generateUltraReport({
        ticketIds,
        language: locale || 'en',
        period,
      });

      setReport(response.report);
      setState('complete');

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['helpdesk-tickets'] });

      onComplete?.(response.report);
    } catch (error) {
      console.error('[Ultra Analysis] Report generation failed:', error);
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to generate report'
      );
    }

    isAnalyzingRef.current = false;
  }, [filterParams, locale, queryClient, onComplete]);

  const handleStartAnalysis = useCallback(() => {
    processTickets();
  }, [processTickets]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleClose = useCallback(() => {
    if (
      state === 'analyzing' ||
      state === 'fetching' ||
      state === 'generating'
    ) {
      abortRef.current = true;
    }
    setOpen(false);
    setTimeout(() => {
      setState('idle');
      setReport(null);
      setErrorMessage('');
      setProgress({
        phase: 'fetching',
        current: 0,
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        currentChunk: 0,
        totalChunks: 0,
        startTime: 0,
        chunkTimes: [],
      });
    }, 300);
  }, [state]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        handleClose();
      } else {
        setOpen(true);
      }
    },
    [handleClose]
  );

  // Export to PDF using html2pdf
  const handleExportPDF = useCallback(async () => {
    if (!report || isExportingPDF) return;

    setIsExportingPDF(true);
    try {
      // Dynamically import html2pdf (browser-only library)
      const html2pdf = (await import('html2pdf.js')).default;

    // Build HTML content for PDF
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin-bottom: 10px;">Ultra Report Analysis</h1>
          <p style="color: #666; font-size: 14px;">
            ${report.ticketCount} tickets analyzed |
            ${new Date(report.period.from).toLocaleDateString()} - ${new Date(report.period.to).toLocaleDateString()}
          </p>
          <p style="color: #999; font-size: 12px;">Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Executive Summary</h2>
          <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${report.executiveSummary}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Sentiment Overview</h2>
          <div style="display: flex; gap: 20px; margin-top: 15px;">
            <div style="flex: 1; text-align: center; padding: 15px; background: #fef2f2; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${report.sentimentAnalysis.distribution.angry}%</div>
              <div style="color: #666; font-size: 12px;">Angry</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 15px; background: #fff7ed; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #ea580c;">${report.sentimentAnalysis.distribution.frustrated}%</div>
              <div style="color: #666; font-size: 12px;">Frustrated</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 15px; background: #f3f4f6; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #4b5563;">${report.sentimentAnalysis.distribution.neutral}%</div>
              <div style="color: #666; font-size: 12px;">Neutral</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 15px; background: #f0fdf4; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${report.sentimentAnalysis.distribution.positive}%</div>
              <div style="color: #666; font-size: 12px;">Positive</div>
            </div>
          </div>
          ${report.sentimentAnalysis.trend ? `<p style="color: #666; margin-top: 15px; font-size: 14px;">${report.sentimentAnalysis.trend}</p>` : ''}
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Top Problems</h2>
          ${report.topProblems.map(problem => `
            <div style="margin: 20px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: ${problem.severity === 'critical' ? '#ef4444' : problem.severity === 'high' ? '#f97316' : problem.severity === 'medium' ? '#eab308' : '#3b82f6'}; color: white; text-align: center; line-height: 28px; font-weight: bold;">${problem.rank}</span>
                <strong style="flex: 1;">${problem.title}</strong>
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${problem.severity === 'critical' ? '#fef2f2' : problem.severity === 'high' ? '#fff7ed' : problem.severity === 'medium' ? '#fefce8' : '#eff6ff'}; color: ${problem.severity === 'critical' ? '#dc2626' : problem.severity === 'high' ? '#ea580c' : problem.severity === 'medium' ? '#ca8a04' : '#2563eb'};">${problem.severity}</span>
                <span style="color: #666; font-size: 14px;">${problem.frequency}%</span>
              </div>
              <p style="color: #4b5563; font-size: 14px; margin-bottom: 10px;">${problem.description}</p>
              ${problem.recommendedActions.length > 0 ? `
                <div style="margin-top: 10px;">
                  <strong style="font-size: 12px; color: #666;">Recommended Actions:</strong>
                  <ul style="margin: 5px 0 0 20px; padding: 0; color: #4b5563; font-size: 13px;">
                    ${problem.recommendedActions.map(action => `<li style="margin-bottom: 3px;">${action}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Category Insights</h2>
          ${report.categoryInsights.map(insight => `
            <div style="margin: 15px 0; padding: 15px; background: #f9fafb; border-radius: 8px; page-break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>${categoryDisplayNames[insight.category]}</strong>
                <span style="color: #666;">${insight.count} tickets (${insight.percentage}%)</span>
              </div>
              ${insight.commonPatterns.length > 0 ? `
                <div style="margin-bottom: 10px;">
                  <strong style="font-size: 12px; color: #666;">Common Patterns:</strong>
                  <ul style="margin: 5px 0 0 20px; padding: 0; color: #4b5563; font-size: 13px;">
                    ${insight.commonPatterns.map(p => `<li style="margin-bottom: 3px;">${p}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${insight.suggestedImprovements.length > 0 ? `
                <div>
                  <strong style="font-size: 12px; color: #666;">Suggested Improvements:</strong>
                  <ul style="margin: 5px 0 0 20px; padding: 0; color: #4b5563; font-size: 13px;">
                    ${insight.suggestedImprovements.map(i => `<li style="margin-bottom: 3px;">${i}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">Action Plan</h2>

          <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; page-break-inside: avoid;">
            <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">🚨 Immediate (This Week)</h3>
            <ul style="margin: 0 0 0 20px; padding: 0; color: #4b5563; font-size: 14px;">
              ${report.actionPlan.immediate.map(a => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
            </ul>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #fefce8; border: 1px solid #fde047; border-radius: 8px; page-break-inside: avoid;">
            <h3 style="color: #ca8a04; margin: 0 0 10px 0; font-size: 16px;">📅 Short Term (This Month)</h3>
            <ul style="margin: 0 0 0 20px; padding: 0; color: #4b5563; font-size: 14px;">
              ${report.actionPlan.shortTerm.map(a => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
            </ul>
          </div>

          <div style="margin: 20px 0; padding: 15px; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; page-break-inside: avoid;">
            <h3 style="color: #2563eb; margin: 0 0 10px 0; font-size: 16px;">🎯 Long Term (Next Quarter)</h3>
            <ul style="margin: 0 0 0 20px; padding: 0; color: #4b5563; font-size: 14px;">
              ${report.actionPlan.longTerm.map(a => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 11px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          Generated by Miomente Ultra Report • Powered by AI
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `ultra-analysis-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

      await html2pdf().set(opt).from(content).save();
    } finally {
      setIsExportingPDF(false);
    }
  }, [report, isExportingPDF]);

  const ticketCount = totalFilteredCount || 0;
  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const estimatedTimeRemaining = getEstimatedTimeRemaining();
  const elapsedTime = getElapsedTime();

  // Update elapsed time display every second during analysis
  const [, setTick] = useState(0);
  useEffect(() => {
    if (
      state === 'analyzing' ||
      state === 'fetching' ||
      state === 'generating'
    ) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
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
        className="border-purple-200 hover:border-purple-400 hover:bg-purple-50"
      >
        <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
        {(helpdesk?.ultraAnalysis as string) || 'Ultra Analysis'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`${state === 'complete' ? 'sm:max-w-[900px] max-h-[90vh]' : 'sm:max-w-[500px]'} overflow-hidden flex flex-col`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {(helpdesk?.ultraAnalysisTitle as string) || 'Ultra Instinct Analysis'}
            </DialogTitle>
            <DialogDescription>
              {state === 'idle' &&
                ((helpdesk?.ultraAnalysisDescription as string) ||
                  'Analyze all filtered tickets to identify recurring problems and generate actionable insights.')}
              {state === 'fetching' &&
                ((helpdesk?.fetchingTickets as string) || 'Fetching tickets...')}
              {state === 'analyzing' &&
                ((helpdesk?.analyzingTickets as string) || 'Analyzing tickets...')}
              {state === 'generating' &&
                ((helpdesk?.generatingReport as string) ||
                  'Generating comprehensive report...')}
              {state === 'complete' &&
                ((helpdesk?.reportReady as string) || 'Report ready!')}
              {state === 'error' &&
                ((helpdesk?.analysisError as string) || 'Analysis failed')}
            </DialogDescription>
          </DialogHeader>

          <div className={`py-4 ${state === 'complete' ? 'flex-1 overflow-auto' : ''}`}>
            {/* Idle State */}
            {state === 'idle' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6">
                  <div className="text-sm text-muted-foreground mb-2">
                    {(helpdesk?.ticketsToAnalyze as string) || 'Tickets to analyze:'}
                  </div>
                  <div className="text-4xl font-bold text-purple-600">
                    {ticketCount}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {(helpdesk?.basedOnFilters as string) ||
                      'Based on current filters'}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      {(helpdesk?.ultraFeature1 as string) ||
                        'Identifies top recurring problems'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      {(helpdesk?.ultraFeature2 as string) ||
                        'Provides category insights and patterns'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      {(helpdesk?.ultraFeature3 as string) ||
                        'Generates actionable improvement plan'}
                    </span>
                  </div>
                </div>

                {ticketCount > 100 && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {(helpdesk?.largeBatchWarning as string) ||
                        'Large batch - analysis may take a few minutes.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Fetching State */}
            {state === 'fetching' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
                <div className="text-center text-sm text-muted-foreground">
                  {(helpdesk?.fetchingTicketIds as string) ||
                    'Fetching ticket IDs...'}
                </div>
              </div>
            )}

            {/* Analyzing State */}
            {state === 'analyzing' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {(helpdesk?.phase as string) || 'Phase'} 1/2:{' '}
                      {(helpdesk?.analyzingTickets as string) ||
                        'Analyzing tickets'}
                    </span>
                    <span className="font-medium">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                    <span>
                      {(helpdesk?.chunk as string) || 'Chunk'}{' '}
                      {progress.currentChunk}/{progress.totalChunks}
                    </span>
                  </div>
                </div>

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
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {(helpdesk?.remaining as string) || 'Remaining:'} ~
                        {formatTimeRemaining(estimatedTimeRemaining)}
                      </span>
                    </div>
                  )}
                </div>

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
                      {progress.skipped} {(helpdesk?.skipped as string) || 'skipped'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Generating State */}
            {state === 'generating' && (
              <div className="flex flex-col items-center py-8">
                <div className="relative">
                  <Sparkles className="h-12 w-12 text-purple-500 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
                  </div>
                </div>
                <div className="text-center mt-4">
                  <div className="font-medium">
                    {(helpdesk?.generatingReport as string) ||
                      'Generating comprehensive report...'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {(helpdesk?.aiProcessing as string) ||
                      'AI is analyzing patterns and generating insights'}
                  </div>
                </div>
              </div>
            )}

            {/* Complete State - Report Display */}
            {state === 'complete' && report && (
              <div className="space-y-4">
                {/* Report Header */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {report.ticketCount} {(helpdesk?.ticketsAnalyzed as string) || 'tickets analyzed'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(report.period.from).toLocaleDateString()} -{' '}
                        {new Date(report.period.to).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(report.generatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="summary" className="text-xs sm:text-sm">
                      <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
                      {(helpdesk?.summaryTab as string) || 'Summary'}
                    </TabsTrigger>
                    <TabsTrigger value="categories" className="text-xs sm:text-sm">
                      <BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />
                      {(helpdesk?.categoriesTab as string) || 'Categories'}
                    </TabsTrigger>
                    <TabsTrigger value="actions" className="text-xs sm:text-sm">
                      <ListTodo className="h-4 w-4 mr-1 hidden sm:inline" />
                      {(helpdesk?.actionsTab as string) || 'Actions'}
                    </TabsTrigger>
                  </TabsList>

                  {/* Summary Tab */}
                  <TabsContent value="summary" className="mt-4 space-y-4">
                    {/* Executive Summary */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
                      <h3 className="font-semibold mb-2">
                        {(helpdesk?.executiveSummary as string) || 'Executive Summary'}
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {report.executiveSummary}
                      </p>
                    </div>

                    {/* Sentiment Overview */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
                      <h3 className="font-semibold mb-3">
                        {(helpdesk?.sentimentOverview as string) || 'Sentiment Overview'}
                      </h3>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                          <div className="font-bold text-red-600">
                            {report.sentimentAnalysis.distribution.angry}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(helpdesk?.sentimentAngry as string) || 'Angry'}
                          </div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-2">
                          <div className="font-bold text-orange-600">
                            {report.sentimentAnalysis.distribution.frustrated}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(helpdesk?.sentimentFrustrated as string) || 'Frustrated'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                          <div className="font-bold text-gray-600 dark:text-gray-300">
                            {report.sentimentAnalysis.distribution.neutral}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(helpdesk?.sentimentNeutral as string) || 'Neutral'}
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                          <div className="font-bold text-green-600">
                            {report.sentimentAnalysis.distribution.positive}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(helpdesk?.sentimentPositive as string) || 'Positive'}
                          </div>
                        </div>
                      </div>
                      {report.sentimentAnalysis.trend && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {report.sentimentAnalysis.trend}
                        </p>
                      )}
                    </div>

                    {/* Top Problems */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">
                        {(helpdesk?.topProblems as string) || 'Top Problems'}
                      </h3>
                      {report.topProblems.map((problem, idx) => (
                        <div
                          key={idx}
                          className="bg-white dark:bg-gray-800 rounded-lg border p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full ${severityColors[problem.severity]} flex items-center justify-center text-white font-bold text-sm`}
                            >
                              {problem.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium">{problem.title}</h4>
                                <Badge variant={severityBadgeVariants[problem.severity]}>
                                  {problem.severity}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {problem.frequency}%
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {problem.description}
                              </p>
                              {problem.recommendedActions.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    {(helpdesk?.recommendedActions as string) ||
                                      'Recommended Actions:'}
                                  </div>
                                  <ul className="text-sm space-y-1">
                                    {problem.recommendedActions.map((action, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <ChevronRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                                        <span>{action}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Categories Tab */}
                  <TabsContent value="categories" className="mt-4">
                    <Accordion type="multiple" className="w-full">
                      {report.categoryInsights.map((insight, idx) => (
                        <AccordionItem key={idx} value={insight.category}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 flex-1 text-left">
                              <span className="font-medium">
                                {(helpdesk?.[`category${insight.category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as keyof typeof helpdesk] as string) ||
                                  categoryDisplayNames[insight.category]}
                              </span>
                              <Badge variant="secondary" className="ml-auto mr-2">
                                {insight.count} ({insight.percentage}%)
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 pt-2">
                              {insight.commonPatterns.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium mb-1">
                                    {(helpdesk?.commonPatterns as string) ||
                                      'Common Patterns:'}
                                  </div>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    {insight.commonPatterns.map((pattern, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-purple-500">•</span>
                                        <span>{pattern}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {insight.suggestedImprovements.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium mb-1">
                                    {(helpdesk?.suggestedImprovements as string) ||
                                      'Suggested Improvements:'}
                                  </div>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    {insight.suggestedImprovements.map((imp, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <ChevronRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>{imp}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </TabsContent>

                  {/* Actions Tab */}
                  <TabsContent value="actions" className="mt-4 space-y-4">
                    {/* Immediate Actions */}
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800 p-4">
                      <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {(helpdesk?.immediateActions as string) || 'Immediate (This Week)'}
                      </h3>
                      <ul className="space-y-2">
                        {report.actionPlan.immediate.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Short Term Actions */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
                      <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {(helpdesk?.shortTermActions as string) || 'Short Term (This Month)'}
                      </h3>
                      <ul className="space-y-2">
                        {report.actionPlan.shortTerm.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Long Term Actions */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                      <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        {(helpdesk?.longTermActions as string) || 'Long Term (Next Quarter)'}
                      </h3>
                      <ul className="space-y-2">
                        {report.actionPlan.longTerm.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="flex flex-col items-center py-8">
                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                <div className="text-center">
                  <div className="font-medium text-red-600">
                    {(helpdesk?.analysisError as string) || 'Analysis failed'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {errorMessage}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            {state === 'idle' && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  {(t.common.cancel as string) || 'Cancel'}
                </Button>
                <Button
                  onClick={handleStartAnalysis}
                  disabled={ticketCount === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {(helpdesk?.startUltraAnalysis as string) || 'Start Analysis'}
                </Button>
              </>
            )}

            {(state === 'analyzing' ||
              state === 'fetching' ||
              state === 'generating') && (
              <Button variant="outline" onClick={handleCancel}>
                {(t.common.cancel as string) || 'Cancel'}
              </Button>
            )}

            {state === 'complete' && (
              <>
                <Button variant="outline" onClick={handleExportPDF} disabled={isExportingPDF}>
                  {isExportingPDF ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExportingPDF
                    ? ((helpdesk?.generatingPdf as string) || 'Generating PDF...')
                    : ((helpdesk?.downloadPdf as string) || 'Download PDF')}
                </Button>
                <Button onClick={handleClose}>
                  {((t.common as Record<string, string>)?.close) || 'Close'}
                </Button>
              </>
            )}

            {state === 'error' && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  {((t.common as Record<string, string>)?.close) || 'Close'}
                </Button>
                <Button
                  onClick={handleStartAnalysis}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {(helpdesk?.retry as string) || 'Retry'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
