'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { de, enUS, uk } from 'date-fns/locale';
import Link from 'next/link';
import {
  MessageSquare,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Search,
  BarChart3,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Ticket, TimePeriod } from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 3: return 'bg-red-100 text-red-800';
    case 2: return 'bg-orange-100 text-orange-800';
    case 1: return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityLabel(priority: number, t: Record<string, unknown>): string {
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;
  switch (priority) {
    case 3: return (helpdesk?.urgent as string) || 'Urgent';
    case 2: return (helpdesk?.high as string) || 'High';
    case 1: return (helpdesk?.normal as string) || 'Normal';
    default: return (helpdesk?.low as string) || 'Low';
  }
}

function TicketRow({ ticket, locale }: { ticket: Ticket; locale: string }) {
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
      <TableCell>
        {ticket.ticket_type_name && (
          <span className="text-sm text-muted-foreground">{ticket.ticket_type_name}</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={getPriorityColor(ticket.priority)}>
          {getPriorityLabel(ticket.priority, t)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        <div title={format(new Date(ticket.create_date), 'PPp', { locale: dateLocale })}>
          {formatDistanceToNow(new Date(ticket.create_date), { addSuffix: true, locale: dateLocale })}
        </div>
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

  // Filter state
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['helpdesk-tickets', period, customFrom, customTo, selectedStage, selectedType, searchQuery, currentPage],
    queryFn: () => api.getHelpdeskTickets({
      period,
      customFrom: period === 'custom' ? customFrom : undefined,
      customTo: period === 'custom' ? customTo : undefined,
      stageIds: selectedStage !== 'all' ? [parseInt(selectedStage)] : undefined,
      typeIds: selectedType !== 'all' ? [parseInt(selectedType)] : undefined,
      search: searchQuery || undefined,
      limit: pageSize,
      offset: currentPage * pageSize,
    }),
    enabled: hasHydrated,
  });

  const handleResetFilters = () => {
    setPeriod('30d');
    setCustomFrom('');
    setCustomTo('');
    setSelectedStage('all');
    setSelectedType('all');
    setSearchQuery('');
    setCurrentPage(0);
  };

  const totalPages = data ? Math.ceil(data.pagination.total / pageSize) : 0;
  const analytics = data?.analytics;

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

      {/* Stats Cards */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">{(helpdesk?.unanswered as string) || 'Unanswered'}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-600">{analytics.unansweredCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">{(helpdesk?.avgResponseTime as string) || 'Avg Response Time'}</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {analytics.avgFirstResponseTimeHours !== null
                  ? `${analytics.avgFirstResponseTimeHours.toFixed(1)}h`
                  : '-'
                }
              </p>
              {analytics.avgFirstResponseTimeHours !== null && (
                <p className={`text-xs mt-1 ${analytics.avgFirstResponseTimeHours <= 24 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.avgFirstResponseTimeHours <= 24
                    ? `✓ ${(helpdesk?.withinTarget as string) || 'Within 24h target'}`
                    : `⚠ ${(helpdesk?.aboveTarget as string) || 'Above 24h target'}`
                  }
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">{(helpdesk?.openTickets as string) || 'Open Tickets'}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{analytics.totalOpen}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">{(helpdesk?.resolved as string) || 'Resolved'}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">{analytics.totalResolved}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Age Buckets */}
      {analytics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {(helpdesk?.ticketsByAge as string) || 'Open Tickets by Age'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <span className="text-sm font-medium text-green-700">&lt; 24h</span>
                <span className="text-xl font-bold text-green-700">{analytics.openByAgeBucket['<24h']}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <span className="text-sm font-medium text-yellow-700">1-3 {(helpdesk?.days as string) || 'days'}</span>
                <span className="text-xl font-bold text-yellow-700">{analytics.openByAgeBucket['1-3d']}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                <span className="text-sm font-medium text-orange-700">3-7 {(helpdesk?.days as string) || 'days'}</span>
                <span className="text-xl font-bold text-orange-700">{analytics.openByAgeBucket['3-7d']}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                <span className="text-sm font-medium text-red-700">&gt; 7 {(helpdesk?.days as string) || 'days'}</span>
                <span className="text-xl font-bold text-red-700">{analytics.openByAgeBucket['>7d']}</span>
              </div>
            </div>
          </CardContent>
        </Card>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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
              <Label>{(helpdesk?.stage as string) || 'Stage'}</Label>
              <Select value={selectedStage} onValueChange={(v) => { setSelectedStage(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={(helpdesk?.allStages as string) || 'All Stages'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{(helpdesk?.allStages as string) || 'All Stages'}</SelectItem>
                  {data?.stages?.map((stage) => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{(helpdesk?.ticketType as string) || 'Type'}</Label>
              <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={(helpdesk?.allTypes as string) || 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{(helpdesk?.allTypes as string) || 'All Types'}</SelectItem>
                  {data?.ticketTypes?.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2 flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                {(t.common.reset as string) || 'Reset'}
              </Button>
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
                    <TableHead>{(helpdesk?.ticketType as string) || 'Type'}</TableHead>
                    <TableHead>{(helpdesk?.priority as string) || 'Priority'}</TableHead>
                    <TableHead>{(helpdesk?.created as string) || 'Created'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} locale={locale} />
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
