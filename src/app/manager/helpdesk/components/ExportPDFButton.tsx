'use client';

import { useState } from 'react';
import { FileDown, Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ExportPDFButtonProps {
  /** Ticket IDs to export */
  ticketIds: number[];
  /** Whether button is disabled */
  disabled?: boolean;
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export function ExportPDFButton({ ticketIds, disabled = false }: ExportPDFButtonProps) {
  const { t, locale } = useI18n();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [includeAnalysis, setIncludeAnalysis] = useState(true);
  const [includeMessages, setIncludeMessages] = useState(true);

  const MAX_EXPORT = 200;
  const ticketCount = ticketIds.length;
  const willTruncate = ticketCount > MAX_EXPORT;

  const handleExport = async () => {
    if (ticketIds.length === 0) return;

    setStatus('loading');
    setError(null);

    try {
      const blob = await api.exportTicketsPDF({
        ticketIds: ticketIds.slice(0, MAX_EXPORT),
        includeAnalysis,
        includeMessages,
        language: locale,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helpdesk-tickets-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setStatus('success');
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('[PDF Export] Error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
      setStatus('error');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStatus('idle');
      setError(null);
    }
    setIsOpen(open);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled || ticketIds.length === 0}
        title={(helpdesk?.exportPDF as string) || 'Export PDF'}
      >
        <FileDown className="h-4 w-4 mr-2" />
        {(helpdesk?.exportPDF as string) || 'Export PDF'}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              {(helpdesk?.exportPDFTitle as string) || 'Export Tickets to PDF'}
            </DialogTitle>
            <DialogDescription>
              {(helpdesk?.exportPDFDesc as string) || 'Download tickets as a PDF document with full details.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Ticket count info */}
            <div className="text-sm text-muted-foreground">
              {willTruncate ? (
                <p className="text-amber-600">
                  {((helpdesk?.exportWillTruncate as string) || 'Only first {max} of {total} tickets will be exported.')
                    .replace('{max}', String(MAX_EXPORT))
                    .replace('{total}', String(ticketCount))}
                </p>
              ) : (
                <p>
                  {((helpdesk?.exportTicketCount as string) || '{count} tickets will be exported.')
                    .replace('{count}', String(ticketCount))}
                </p>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAnalysis"
                  checked={includeAnalysis}
                  onCheckedChange={(checked) => setIncludeAnalysis(checked === true)}
                  disabled={status === 'loading'}
                />
                <Label htmlFor="includeAnalysis" className="cursor-pointer">
                  {(helpdesk?.includeAIAnalysis as string) || 'Include AI Analysis'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeMessages"
                  checked={includeMessages}
                  onCheckedChange={(checked) => setIncludeMessages(checked === true)}
                  disabled={status === 'loading'}
                />
                <Label htmlFor="includeMessages" className="cursor-pointer">
                  {(helpdesk?.includeMessages as string) || 'Include Message Thread'}
                </Label>
              </div>
            </div>

            {/* Status messages */}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{(helpdesk?.exportSuccess as string) || 'PDF downloaded successfully!'}</span>
              </div>
            )}

            {status === 'error' && error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Export button */}
            <Button
              onClick={handleExport}
              disabled={status === 'loading' || ticketIds.length === 0}
              className="w-full"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {(helpdesk?.exporting as string) || 'Generating PDF...'}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {(helpdesk?.downloadPDF as string) || 'Download PDF'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
