'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { de, enUS, uk } from 'date-fns/locale';
import Link from 'next/link';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Ticket, TimePeriod, AITicketFilters, StoredTicketAnalysis, FilterPreferences, AICategory } from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
import { AIAnalysisBatchModal } from './components/AIAnalysisBatchModal';
import { AIFilterDropdowns } from './components/AIFilterDropdowns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function getUrgencyBadgeColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'angry': return 'text-red-500';
    case 'frustrated': return 'text-orange-500';
    case 'neutral': return 'text-gray-500';
    case 'satisfied': return 'text-green-500';
    case 'grateful': return 'text-emerald-500';
    default: return 'text-gray-400';
  }
}

function formatCategory(category: AICategory): string {
  const labels: Record<AICategory, string> = {
    missing_dates: 'Missing Dates',
    refund_request: 'Refund',
    voucher_not_received: 'Voucher',
    voucher_expired: 'Expired',
    booking_change: 'Booking',
    complaint: 'Complaint',
    general_inquiry: 'Inquiry',
    partner_issue: 'Partner',
    payment_issue: 'Payment',
    technical_issue: 'Technical',
    other: 'Other',
  };
  return labels[category] || category;
}

function TicketRow({
  ticket,
  locale,
  analysis,
}: {
  ticket: Ticket;
  locale: string;
  analysis?: StoredTicketAnalysis;
}) {
  const { t } = useI18n();
  const dateLocale = locale === 'de' ? de : locale === 'uk' ? uk : enUS;
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-mono text-sm">
        <Link
          href={`/manager/helpdesk/${ticket.id}`}
          className="hover:underline text-primary"
        >
          #{ticket.id}
        </Link>
      </TableCell>
      <TableCell>
        <div className="max-w-[300px]">
          <Link
            href={`/manager/helpdesk/${ticket.id}`}
            className="font-medium hover:underline line-clamp-1"
          >
            {ticket.name}
          </Link>
          {ticket.partner_email && (
            <p className="text-xs text-muted-foreground truncate">{ticket.partner_email}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={
          ticket.stage_status === 'new' ? 'border-blue-500 text-blue-700' :
          ticket.stage_status === 'in_progress' ? 'border-yellow-500 text-yellow-700' :
          ticket.stage_status === 'waiting_customer' ? 'border-purple-500 text-purple-700' :
          ticket.stage_status === 'solved' ? 'border-green-500 text-green-700' :
          ticket.stage_status === 'cancelled' ? 'border-gray-500 text-gray-600' :
          'border-gray-300'
        }>
          {ticket.stage_name}
        </Badge>
      </TableCell>
      {/* AI Analysis Column */}
      <TableCell>
        {analysis ? (
          <div className="flex items-center gap-1 flex-wrap">
            {/* Urgency badge */}
            <Badge className={`text-xs ${getUrgencyBadgeColor(analysis.urgency)}`}>
              {analysis.urgency}
            </Badge>
            {/* Category badge */}
            {analysis.category && (
              <Badge variant="outline" className="text-xs">
                {formatCategory(analysis.category)}
              </Badge>
            )}
            {/* Sentiment indicator */}
            {analysis.sentiment && (
              <span className={`text-xs ${getSentimentColor(analysis.sentiment)}`} title={`Sentiment: ${analysis.sentiment}`}>
                {analysis.sentiment === 'angry' && '😠'}
                {analysis.sentiment === 'frustrated' && '😤'}
                {analysis.sentiment === 'neutral' && '😐'}
                {analysis.sentiment === 'positive' && '😊'}
              </span>
            )}
            {/* Awaiting answer indicator */}
            {analysis.lastMessageAuthorType && analysis.lastMessageAuthorType !== 'support_team' && (
              <Badge variant="outline" className="text-xs border-purple-500 text-purple-700">
                {(helpdesk?.awaiting as string) || '⏳'}
              </Badge>
            )}
            {/* Stale indicator */}
            {analysis.isStale && (
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-700" title="Analysis is outdated">
                {(helpdesk?.stale as string) || '🔄'}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        <div title={format(new Date(ticket.create_date), 'PPp', { locale: dateLocale })}>
          {formatDistanceToNow(new Date(ticket.create_date), { addSuffix: true, locale: dateLocale })}
        </div>
      </TableCell>
      <TableCell>
        <a
          href={`https://odoo.boni.tools/odoo/action-1463/${ticket.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </TableCell>
      <TableCell>
        <Link href={`/manager/helpdesk/${ticket.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}

export default function HelpdeskPage() {
  const { t, locale } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  // Refs for initialization and debouncing
  const filtersInitializedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveFiltersMutateRef = useRef<((filterPreferences: FilterPreferences) => void) | null>(null);

  // Filter state - initialize with defaults, will be restored from settings on load
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedStageIds, setSelectedStageIds] = useState<number[]>([]);
  const [pendingStageIds, setPendingStageIds] = useState<number[]>([]);
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const [aiFilters, setAIFilters] = useState<Partial<AITicketFilters>>({});
  const pageSize = 25;

  // Load filter preferences on mount
  const { data: settingsData } = useQuery({
    queryKey: ['helpdesk-settings'],
    queryFn: () => api.getHelpdeskSettings(),
    enabled: hasHydrated,
  });

  // Restore filters from settings when they first load
  useEffect(() => {
    if (settingsData?.settings?.filterPreferences && !filtersInitializedRef.current) {
      filtersInitializedRef.current = true;
      const prefs = settingsData.settings.filterPreferences;
      // Use startTransition to batch state updates as low-priority updates
      startTransition(() => {
        setPeriod(prefs.period || '30d');
        setCustomFrom(prefs.customFrom || '');
        setCustomTo(prefs.customTo || '');
        setSearchQuery(prefs.searchQuery || '');
        const stageIds = prefs.selectedStageIds || [];
        setSelectedStageIds(stageIds);
        setPendingStageIds(stageIds);
        setAIFilters({
          aiUrgency: prefs.aiUrgency,
          aiCategory: prefs.aiCategory,
          aiSentiment: prefs.aiSentiment,
          aiSatisfaction: prefs.aiSatisfaction,
          aiIsResolved: prefs.aiIsResolved,
          awaitingAnswer: prefs.awaitingAnswer,
        });
      });
    }
  }, [settingsData]);

  // Save filter preferences mutation
  const saveFiltersMutation = useMutation({
    mutationFn: (filterPreferences: FilterPreferences) =>
      api.updateHelpdeskSettings({ filterPreferences }),
  });

  // Keep mutate function in ref to avoid dependency issues
  saveFiltersMutateRef.current = saveFiltersMutation.mutate;

  // Save filters when they change (after initial load) - debounced
  useEffect(() => {
    if (!filtersInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const filterPreferences: FilterPreferences = {
        period,
        customFrom: period === 'custom' ? customFrom : undefined,
        customTo: period === 'custom' ? customTo : undefined,
        searchQuery: searchQuery || undefined,
        selectedStageIds: selectedStageIds.length > 0 ? selectedStageIds : undefined,
        aiUrgency: aiFilters.aiUrgency,
        aiCategory: aiFilters.aiCategory,
        aiSentiment: aiFilters.aiSentiment,
        aiSatisfaction: aiFilters.aiSatisfaction,
        aiIsResolved: aiFilters.aiIsResolved,
        awaitingAnswer: aiFilters.awaitingAnswer,
      };
      saveFiltersMutateRef.current?.(filterPreferences);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [period, customFrom, customTo, searchQuery, selectedStageIds, aiFilters]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['helpdesk-tickets', period, customFrom, customTo, searchQuery, currentPage, selectedStageIds, aiFilters],
    queryFn: () => api.getHelpdeskTickets({
      period,
      customFrom: period === 'custom' ? customFrom : undefined,
      customTo: period === 'custom' ? customTo : undefined,
      stageIds: selectedStageIds.length > 0 ? selectedStageIds : undefined,
      search: searchQuery || undefined,
      limit: pageSize,
      offset: currentPage * pageSize,
      // AI filters
      aiUrgency: aiFilters.aiUrgency,
      aiCategory: aiFilters.aiCategory,
      aiSentiment: aiFilters.aiSentiment,
      aiSatisfaction: aiFilters.aiSatisfaction,
      aiIsResolved: aiFilters.aiIsResolved,
      aiAwaitingAnswer: aiFilters.awaitingAnswer,
      includeAnalysis: true,
    }),
    enabled: hasHydrated,
  });

  const handleResetFilters = () => {
    setPeriod('30d');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
    setSelectedStageIds([]);
    setPendingStageIds([]);
    setCurrentPage(0);
    setAIFilters({});
  };

  const handleStageToggle = (stageId: number) => {
    setPendingStageIds((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId]
    );
  };

  const handleApplyStages = () => {
    setSelectedStageIds(pendingStageIds);
    setCurrentPage(0);
    setStagePopoverOpen(false);
  };

  const handleStagePopoverOpenChange = (open: boolean) => {
    if (open) {
      // Sync pending state with current state when opening
      setPendingStageIds(selectedStageIds);
    }
    setStagePopoverOpen(open);
  };

  const handleAIFiltersChange = (newFilters: Partial<AITicketFilters>) => {
    setAIFilters(newFilters);
    setCurrentPage(0);
  };

  const totalPages = data ? Math.ceil(data.pagination.total / pageSize) : 0;
  const analytics = data?.analytics;

  // Calculate if all filtered tickets (across ALL pages) have AI analysis
  const totalFilteredTickets = data?.pagination.total || 0;
  const totalAnalyzedCount = data?.totalAnalyzedCount ?? 0;
  // AI filters are available when: all tickets are analyzed OR there are no tickets (0 results)
  const allFilteredTicketsAnalyzed = totalFilteredTickets === 0 || totalAnalyzedCount >= totalFilteredTickets;

  // AI filters are only available when ALL filtered tickets are analyzed (or no tickets)
  const aiFiltersDisabled = isLoading || !allFilteredTicketsAnalyzed;
  const aiFiltersDisabledReason = isLoading
    ? undefined
    : !allFilteredTicketsAnalyzed
    ? `${totalAnalyzedCount}/${totalFilteredTickets} analyzed`
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{(helpdesk?.title as string) || 'Helpdesk'}</h1>
          <p className="text-muted-foreground">{(helpdesk?.description as string) || 'Monitor and analyze customer support tickets'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {(t.common.refresh as string) || 'Refresh'}
        </Button>
      </div>

      {/* Stage Counts */}
      {data?.stages && data.stages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.stages
            .sort((a, b) => a.sequence - b.sequence)
            .map((stage) => (
              <Badge
                key={stage.id}
                variant="outline"
                className={`text-sm px-3 py-1.5 ${
                  stage.is_close
                    ? 'border-green-500 text-green-700 bg-green-50'
                    : 'border-blue-500 text-blue-700 bg-blue-50'
                }`}
              >
                {stage.name}
                {stage.ticketCount !== undefined && (
                  <span className="ml-2 font-bold">{stage.ticketCount}</span>
                )}
              </Badge>
            ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {(t.common.filters as string) || 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{(helpdesk?.period as string) || 'Period'}</Label>
              <Select value={period} onValueChange={(v) => { setPeriod(v as TimePeriod); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{(helpdesk?.today as string) || 'Today'}</SelectItem>
                  <SelectItem value="7d">{(helpdesk?.last7Days as string) || 'Last 7 Days'}</SelectItem>
                  <SelectItem value="30d">{(helpdesk?.last30Days as string) || 'Last 30 Days'}</SelectItem>
                  <SelectItem value="all">{(helpdesk?.allTime as string) || 'All Time'}</SelectItem>
                  <SelectItem value="custom">{(helpdesk?.customRange as string) || 'Custom Range'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>{(helpdesk?.from as string) || 'From'}</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => { setCustomFrom(e.target.value); setCurrentPage(0); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{(helpdesk?.to as string) || 'To'}</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => { setCustomTo(e.target.value); setCurrentPage(0); }}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{(helpdesk?.search as string) || 'Search'}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={(helpdesk?.searchPlaceholder as string) || 'Search tickets...'}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Stage Filter */}
            {(data?.stages?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>{(helpdesk?.stage as string) || 'Stage'}</Label>
                <Popover open={stagePopoverOpen} onOpenChange={handleStagePopoverOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      disabled={isLoading}
                    >
                      <span className="truncate">
                        {selectedStageIds.length === 0
                          ? ((helpdesk?.allStages as string) || 'All Stages')
                          : `${selectedStageIds.length} selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {data?.stages?.map((stage) => (
                        <label
                          key={stage.id}
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded-md"
                        >
                          <Checkbox
                            checked={pendingStageIds.includes(stage.id)}
                            onCheckedChange={() => handleStageToggle(stage.id)}
                          />
                          <span className="text-sm truncate" title={stage.name}>
                            {stage.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="border-t mt-2 pt-2 flex gap-2">
                      {pendingStageIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPendingStageIds([])}
                        >
                          {(helpdesk?.clearSelection as string) || 'Clear'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleApplyStages}
                      >
                        {(t.common.apply as string) || 'Apply'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-2 flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                {(t.common.reset as string) || 'Reset'}
              </Button>
            </div>
          </div>

          {/* AI Filters */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <AIFilterDropdowns
                  filters={aiFilters}
                  onFiltersChange={handleAIFiltersChange}
                  disabled={aiFiltersDisabled}
                  disabledReason={aiFiltersDisabledReason}
                />
              </div>
              <AIAnalysisBatchModal
                tickets={data?.tickets || []}
                filterParams={{
                  period,
                  customFrom: period === 'custom' ? customFrom : undefined,
                  customTo: period === 'custom' ? customTo : undefined,
                  stageIds: selectedStageIds.length > 0 ? selectedStageIds : undefined,
                  search: searchQuery || undefined,
                  aiFilters,
                }}
                totalFilteredCount={data?.pagination.total}
                onComplete={() => refetch()}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {(helpdesk?.tickets as string) || 'Tickets'} ({data?.pagination.total || 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{(t.common.loading as string) || 'Loading...'}</p>
            </div>
          ) : !data?.tickets.length ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{(helpdesk?.noTickets as string) || 'No tickets found'}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>{(helpdesk?.subject as string) || 'Subject'}</TableHead>
                    <TableHead>{(helpdesk?.stage as string) || 'Stage'}</TableHead>
                    <TableHead>{(helpdesk?.aiAnalysis as string) || 'AI'}</TableHead>
                    <TableHead>{(helpdesk?.created as string) || 'Created'}</TableHead>
                    <TableHead className="w-[60px]">Odoo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tickets.map((ticket) => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      locale={locale}
                      analysis={data.analysisMap?.[ticket.id]}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {(t.manager?.page as string) || 'Page'} {currentPage + 1} {(t.manager?.of as string) || 'of'} {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {(t.common.previous as string) || 'Previous'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!data.pagination.hasMore}
                    >
                      {(t.common.next as string) || 'Next'}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
