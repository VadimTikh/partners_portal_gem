'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { BookingStatus, ManagerBooking, PartnerSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock, CheckCircle, XCircle, AlertTriangle, Bell, ChevronLeft, ChevronRight, ExternalLink, Ticket, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

// Status filter tabs
type StatusFilter = 'all' | BookingStatus;

// Format response time
function formatResponseTime(
  createdAt: string,
  processedAt: string | null,
  waitingLabel: string
): string {
  const created = parseISO(createdAt);

  if (!processedAt) {
    const hours = differenceInHours(new Date(), created);
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h (${waitingLabel})`;
    }
    if (hours > 0) {
      return `${hours}h (${waitingLabel})`;
    }
    return `< 1h (${waitingLabel})`;
  }

  const processed = parseISO(processedAt);
  const hours = differenceInHours(processed, created);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return '< 1h';
}

// Status badge component
function StatusBadge({ status, t }: { status: BookingStatus; t: Record<string, string> }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="mr-1 h-3 w-3" />
          {t.filterPending}
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="mr-1 h-3 w-3" />
          {t.filterConfirmed}
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="mr-1 h-3 w-3" />
          {t.filterDeclined}
        </Badge>
      );
  }
}

// Reminder indicator
function ReminderIndicator({ count }: { count: number }) {
  if (count === 0) return <span className="text-muted-foreground">-</span>;

  let color = 'text-gray-500';
  if (count === 1) color = 'text-yellow-500';
  if (count === 2) color = 'text-orange-500';
  if (count >= 3) color = 'text-red-500';

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Bell className="h-3 w-3" />
      <span className="font-medium">{count}</span>
    </div>
  );
}

export default function ManagerBookingsPage() {
  const { t, locale } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected booking for detail view
  const [selectedBooking, setSelectedBooking] = useState<ManagerBooking | null>(null);

  // Get translations
  const tb = t.managerBookings || {};

  // Date locale
  const dateLocale = locale === 'de' ? de : enUS;

  // Fetch bookings
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['manager-bookings', statusFilter, partnerFilter, page],
    queryFn: () =>
      api.getManagerBookings({
        status: statusFilter === 'all' ? undefined : statusFilter,
        partnerId: partnerFilter === 'all' ? undefined : partnerFilter,
        page,
        limit,
      }),
    enabled: hasHydrated,
    staleTime: 30000, // 30 seconds
  });

  const bookings = data?.bookings || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const stats = data?.stats || { total: 0, pending: 0, confirmed: 0, declined: 0 };
  const partners = data?.partners || [];

  // Reset page when filters change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handlePartnerChange = (value: string) => {
    setPartnerFilter(value);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tb.title}</h1>
          <p className="text-muted-foreground">{tb.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t.common.refresh}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{tb.total}</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={statusFilter === 'pending' ? 'ring-2 ring-yellow-400' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              {tb.pending}
            </CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={statusFilter === 'confirmed' ? 'ring-2 ring-green-400' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {tb.confirmed}
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.confirmed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={statusFilter === 'declined' ? 'ring-2 ring-red-400' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              {tb.declined}
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.declined}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Status tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(['all', 'pending', 'confirmed', 'declined'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleStatusChange(status)}
              className="px-3"
            >
              {status === 'all' ? tb.filterAll : tb[`filter${status.charAt(0).toUpperCase() + status.slice(1)}` as keyof typeof tb]}
            </Button>
          ))}
        </div>

        {/* Partner filter */}
        <Select value={partnerFilter} onValueChange={handlePartnerChange}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={tb.allPartners} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tb.allPartners}</SelectItem>
            {partners.map((partner: PartnerSummary) => (
              <SelectItem key={partner.id} value={partner.id}>
                {partner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">{tb.noBookings}</p>
            <p className="text-muted-foreground">{tb.noBookingsDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">{tb.orderNumber}</TableHead>
                <TableHead>{tb.partner}</TableHead>
                <TableHead>{tb.customer}</TableHead>
                <TableHead className="hidden lg:table-cell">{tb.course}</TableHead>
                <TableHead className="hidden md:table-cell">{tb.eventDate}</TableHead>
                <TableHead>{tb.status}</TableHead>
                <TableHead className="text-center hidden sm:table-cell">{tb.reminders}</TableHead>
                <TableHead className="hidden xl:table-cell">{tb.ticket}</TableHead>
                <TableHead className="hidden lg:table-cell">{tb.responseTime}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking: ManagerBooking) => (
                <TableRow
                  key={booking.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedBooking(booking)}
                >
                  <TableCell className="font-mono text-sm">
                    {booking.orderNumber || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{booking.partnerName}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {booking.partnerEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{booking.customerName || '-'}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {booking.customerEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="truncate max-w-[200px] block">
                      {booking.courseName || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {booking.eventDate ? (
                      <div className="flex flex-col">
                        <span>{format(parseISO(booking.eventDate), 'dd.MM.yyyy')}</span>
                        {booking.eventTime && (
                          <span className="text-xs text-muted-foreground">{booking.eventTime}</span>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} t={tb} />
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <ReminderIndicator count={booking.reminderCount} />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {booking.odooTicketId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`https://odoo.boni.tools/odoo/action-1463/${booking.odooTicketId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Ticket className="h-3 w-3" />
                            {booking.odooTicketId}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>{tb.escalated}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm">{tb.noTicket}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className={booking.status === 'pending' ? 'text-yellow-600' : ''}>
                      {formatResponseTime(
                        booking.createdAt,
                        booking.confirmedAt || booking.declinedAt,
                        tb.waiting
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {tb.page} {page} {tb.of} {totalPages} ({total} {tb.total?.toLowerCase()})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t.common.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t.common.next}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {tb.orderNumber}: {selectedBooking.orderNumber || '-'}
                  <StatusBadge status={selectedBooking.status} t={tb} />
                </DialogTitle>
                <DialogDescription>
                  {tb.created}:{' '}
                  {format(parseISO(selectedBooking.createdAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {/* Partner Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">{tb.partner}</h4>
                    <div className="space-y-1 text-sm">
                      <p>{selectedBooking.partnerName}</p>
                      <p className="text-muted-foreground">{selectedBooking.partnerEmail}</p>
                      <p className="text-muted-foreground text-xs">
                        {tb.customerNumber}: {selectedBooking.customerNumber}
                      </p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div>
                    <h4 className="font-medium mb-2">{tb.customer}</h4>
                    <div className="space-y-1 text-sm">
                      <p>{selectedBooking.customerName || '-'}</p>
                      <p className="text-muted-foreground">{selectedBooking.customerEmail}</p>
                      {selectedBooking.customerPhone && (
                        <p className="text-muted-foreground">{selectedBooking.customerPhone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Course Info */}
                <div>
                  <h4 className="font-medium mb-2">{tb.course}</h4>
                  <div className="space-y-1 text-sm">
                    <p>{selectedBooking.courseName || '-'}</p>
                    <div className="flex gap-4 text-muted-foreground">
                      {selectedBooking.eventDate && (
                        <span>
                          {tb.eventDate}: {format(parseISO(selectedBooking.eventDate), 'dd.MM.yyyy')}
                          {selectedBooking.eventTime && ` ${selectedBooking.eventTime}`}
                        </span>
                      )}
                      <span>{tb.participants}: {selectedBooking.participants}</span>
                      <span>{tb.price}: {selectedBooking.price.toFixed(2)} EUR</span>
                    </div>
                  </div>
                </div>

                {/* Status Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">{tb.status}</h4>
                    <div className="space-y-2 text-sm">
                      <StatusBadge status={selectedBooking.status} t={tb} />
                      <p className="text-muted-foreground">
                        {tb.responseTime}:{' '}
                        {formatResponseTime(
                          selectedBooking.createdAt,
                          selectedBooking.confirmedAt || selectedBooking.declinedAt,
                          tb.waiting
                        )}
                      </p>
                      {selectedBooking.confirmedAt && (
                        <p className="text-muted-foreground">
                          {tb.processed}:{' '}
                          {format(parseISO(selectedBooking.confirmedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      )}
                      {selectedBooking.declinedAt && (
                        <p className="text-muted-foreground">
                          {tb.processed}:{' '}
                          {format(parseISO(selectedBooking.declinedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">{tb.reminders} & {tb.ticket}</h4>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        {selectedBooking.reminderCount} {tb.reminders?.toLowerCase()}
                      </p>
                      {selectedBooking.odooTicketId ? (
                        <a
                          href={`https://odoo.boni.tools/odoo/action-1463/${selectedBooking.odooTicketId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Ticket className="h-4 w-4" />
                          {tb.ticket}: {selectedBooking.odooTicketId}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{tb.noTicket}</p>
                      )}
                      {selectedBooking.escalatedAt && (
                        <p className="text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          {tb.escalated}:{' '}
                          {format(parseISO(selectedBooking.escalatedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Decline Info */}
                {selectedBooking.status === 'declined' && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2 text-red-600">{tb.declineReason}</h4>
                    <div className="space-y-2 text-sm">
                      <p>{selectedBooking.declineReason || '-'}</p>
                      {selectedBooking.declineNotes && (
                        <div>
                          <p className="text-muted-foreground font-medium">{tb.declineNotes}:</p>
                          <p className="text-muted-foreground">{selectedBooking.declineNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
