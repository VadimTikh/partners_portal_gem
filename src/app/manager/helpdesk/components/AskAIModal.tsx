'use client';

import { useState, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { TimePeriod, AITicketFilters } from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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

interface AskAIModalProps {
  filterParams?: FilterParams;
  totalFilteredCount?: number;
}

type ModalState = 'idle' | 'fetching' | 'asking' | 'complete' | 'error';

// Max question length to prevent exceeding Gemini API limits
const MAX_QUESTION_LENGTH = 2000;

export function AskAIModal({
  filterParams,
  totalFilteredCount,
}: AskAIModalProps) {
  const { t, locale } = useI18n();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ModalState>('idle');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [ticketCount, setTicketCount] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Ref to track timeout for state reset (prevents race condition on quick reopen)
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!question.trim()) return;

    // Check question length
    if (question.trim().length > MAX_QUESTION_LENGTH) {
      setState('error');
      setErrorMessage(
        locale === 'de'
          ? `Die Frage ist zu lang. Maximum: ${MAX_QUESTION_LENGTH} Zeichen.`
          : locale === 'uk'
          ? `Питання занадто довге. Максимум: ${MAX_QUESTION_LENGTH} символів.`
          : `Question is too long. Maximum: ${MAX_QUESTION_LENGTH} characters.`
      );
      return;
    }

    setState('fetching');
    setErrorMessage('');

    try {
      // First, fetch all ticket IDs matching the current filters
      const { ticketIds } = await api.getFilteredTicketIds({
        period: filterParams?.period,
        customFrom: filterParams?.customFrom,
        customTo: filterParams?.customTo,
        stageIds: filterParams?.aiFilters?.selectedStageIds || filterParams?.stageIds,
        typeIds: filterParams?.typeIds,
        search: filterParams?.search,
        aiUrgency: filterParams?.aiFilters?.aiUrgency,
        aiCategory: filterParams?.aiFilters?.aiCategory,
        aiSentiment: filterParams?.aiFilters?.aiSentiment,
        aiSatisfaction: filterParams?.aiFilters?.aiSatisfaction,
        aiIsResolved: filterParams?.aiFilters?.aiIsResolved,
        aiAwaitingAnswer: filterParams?.aiFilters?.awaitingAnswer,
      });

      if (ticketIds.length === 0) {
        setState('error');
        setErrorMessage(
          locale === 'de'
            ? 'Keine Tickets gefunden, die den aktuellen Filtern entsprechen.'
            : locale === 'uk'
            ? 'Не знайдено тікетів, що відповідають поточним фільтрам.'
            : 'No tickets found matching the current filters.'
        );
        return;
      }

      setState('asking');

      // Ask AI the question
      const response = await api.askAI({
        ticketIds,
        question: question.trim(),
        language: locale || 'en',
      });

      setAnswer(response.answer);
      setTicketCount(response.ticketCount);
      setAnalyzedCount(response.analyzedCount);
      setState('complete');
    } catch (error) {
      console.error('[Ask AI] Error:', error);
      setState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to process question'
      );
    }
  }, [question, filterParams, locale]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [answer]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Clear any existing timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    // Reset state after close animation
    resetTimeoutRef.current = setTimeout(() => {
      setState('idle');
      setQuestion('');
      setAnswer('');
      setTicketCount(0);
      setAnalyzedCount(0);
      setErrorMessage('');
      setCopied(false);
      resetTimeoutRef.current = null;
    }, 300);
  }, []);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
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
    },
    [handleClose]
  );

  const handleNewQuestion = useCallback(() => {
    setState('idle');
    setQuestion('');
    setAnswer('');
    setTicketCount(0);
    setAnalyzedCount(0);
    setErrorMessage('');
  }, []);

  const ticketCountDisplay = totalFilteredCount || 0;
  const isProcessing = state === 'fetching' || state === 'asking';

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={ticketCountDisplay === 0}
        className="border-blue-200 hover:border-blue-400 hover:bg-blue-50"
      >
        <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
        {(helpdesk?.askAI as string) || 'Ask AI'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              {(helpdesk?.askAITitle as string) || 'Ask AI About Tickets'}
            </DialogTitle>
            <DialogDescription>
              {state === 'idle' &&
                ((helpdesk?.askAIDescription as string) ||
                  'Ask a question about the filtered tickets. AI will analyze the data and provide insights.')}
              {state === 'fetching' &&
                ((helpdesk?.fetchingTickets as string) || 'Fetching tickets...')}
              {state === 'asking' &&
                ((helpdesk?.aiThinking as string) || 'AI is thinking...')}
              {state === 'complete' &&
                `${analyzedCount} / ${ticketCount} ${(helpdesk?.ticketsAnalyzed as string) || 'tickets analyzed'}`}
              {state === 'error' &&
                ((helpdesk?.askAIError as string) || 'Something went wrong')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Idle State - Question Input */}
            {state === 'idle' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {ticketCountDisplay}
                  </span>{' '}
                  {(helpdesk?.ticketsSelected as string) || 'tickets selected based on current filters'}
                </div>

                <div className="space-y-1">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                      (helpdesk?.askAIPlaceholder as string) ||
                      'e.g., How many tickets are about refunds? What are the most common complaints? Which issues need urgent attention?'
                    }
                    className={`min-h-[120px] resize-none ${question.length > MAX_QUESTION_LENGTH ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    autoFocus
                  />
                  <div className={`text-xs text-right ${question.length > MAX_QUESTION_LENGTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {question.length} / {MAX_QUESTION_LENGTH}
                  </div>
                </div>

                {ticketCountDisplay > 500 && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {(helpdesk?.largeDatasetWarning as string) ||
                        'Large dataset - response may take longer.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Fetching/Asking State */}
            {isProcessing && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                <div className="text-center">
                  <div className="font-medium">
                    {state === 'fetching'
                      ? (helpdesk?.fetchingTicketData as string) || 'Fetching ticket data...'
                      : (helpdesk?.aiAnalyzing as string) || 'AI is analyzing the data...'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {(helpdesk?.pleaseWait as string) || 'Please wait'}
                  </div>
                </div>
              </div>
            )}

            {/* Complete State - Answer Display */}
            {state === 'complete' && (
              <div className="space-y-4">
                {/* Question recap */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {(helpdesk?.yourQuestion as string) || 'Your question:'}
                  </div>
                  <div className="text-sm">{question}</div>
                </div>

                {/* Answer */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {(helpdesk?.aiAnswer as string) || 'AI Answer:'}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-8 px-2"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {answer}
                  </div>
                </div>

                {/* Stats */}
                {analyzedCount < ticketCount && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {locale === 'de'
                        ? `Nur ${analyzedCount} von ${ticketCount} Tickets haben AI-Analyse. Führen Sie zuerst eine AI-Analyse durch, um vollständigere Ergebnisse zu erhalten.`
                        : locale === 'uk'
                        ? `Лише ${analyzedCount} з ${ticketCount} тікетів мають AI-аналіз. Спочатку запустіть AI-аналіз для повніших результатів.`
                        : `Only ${analyzedCount} of ${ticketCount} tickets have AI analysis. Run AI analysis first for more complete results.`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                  <div className="text-red-600 font-medium mb-1">
                    {(helpdesk?.errorOccurred as string) || 'An error occurred'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {errorMessage}
                  </div>
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
                  onClick={handleSubmit}
                  disabled={!question.trim() || question.length > MAX_QUESTION_LENGTH}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {(helpdesk?.askQuestion as string) || 'Ask Question'}
                </Button>
              </>
            )}

            {isProcessing && (
              <Button variant="outline" onClick={handleClose}>
                {(t.common.cancel as string) || 'Cancel'}
              </Button>
            )}

            {state === 'complete' && (
              <>
                <Button variant="outline" onClick={handleNewQuestion}>
                  {(helpdesk?.askAnother as string) || 'Ask Another Question'}
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
                  onClick={handleNewQuestion}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {(helpdesk?.tryAgain as string) || 'Try Again'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
