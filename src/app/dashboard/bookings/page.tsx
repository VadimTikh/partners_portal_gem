'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isValid, Locale } from 'date-fns';
import { de, enUS, uk } from 'date-fns/locale';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Phone,
  Mail,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth';
import { Booking, BookingStatus, DeclineReason } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type FilterStatus = 'all' | BookingStatus;

const getDateLocale = (locale: string) => {
  switch (locale) {
    case 'de':
      return de;
    case 'uk':
      return uk;
    default:
      return enUS;
  }
};

const getStatusBadge = (
  status: BookingStatus,
  t: ReturnType<typeof useI18n>['t']
) => {
  const statusConfig = {
    pending: {
      label: t.bookings.statusPending,
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
    confirmed: {
      label: t.bookings.statusConfirmed,
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    declined: {
      label: t.bookings.statusDeclined,
      variant: 'destructive' as const,
      icon: XCircle,
      className: undefined as string | undefined,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
};

interface BookingCardProps {
  booking: Booking;
  t: ReturnType<typeof useI18n>['t'];
  dateLocale: Locale;
  onConfirm: () => void;
  onDecline: () => void;
  isConfirming: boolean;
}

function BookingCard({
  booking,
  t,
  dateLocale,
  onConfirm,
  onDecline,
  isConfirming,
}: BookingCardProps) {
  const isPending = booking.status === 'pending';

  return (
    <Card className={isPending ? 'border-yellow-300 bg-yellow-50/50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{booking.course.name}</CardTitle>
            <CardDescription className="mt-1">
              {t.bookings.orderNumber}: {booking.orderNumber}
            </CardDescription>
          </div>
          {getStatusBadge(booking.status, t)}
        </div>
      </CardHeader>
      <CardContent>
        {/* Customer Info */}
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="font-medium mb-2">{t.bookings.customer}</p>
          <p className="text-sm">
            {booking.customer.firstName} {booking.customer.lastName}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {booking.customer.email}
            </span>
            {booking.customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {booking.customer.phone}
              </span>
            )}
          </div>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">{t.bookings.eventDate}</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {booking.eventDate && isValid(new Date(booking.eventDate))
                ? format(new Date(booking.eventDate), 'PPP', { locale: dateLocale })
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.bookings.eventTime}</p>
            <p className="text-sm font-medium">{booking.eventTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.bookings.participants}</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />
              {booking.participants}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t.bookings.price}</p>
            <p className="text-sm font-medium">
              {booking.price.toFixed(2)} {booking.currency}
            </p>
          </div>
        </div>

        {/* Confirmation status info */}
        {booking.confirmationStatus.confirmedAt && (
          <div className="text-sm text-green-700 bg-green-50 p-2 rounded mb-4">
            {t.bookings.confirmedAt}:{' '}
            {format(new Date(booking.confirmationStatus.confirmedAt), 'PPp', {
              locale: dateLocale,
            })}{' '}
            ({booking.confirmationStatus.confirmedBy === 'email_token'
              ? t.bookings.viaEmail
              : t.bookings.viaPortal}
            )
          </div>
        )}

        {booking.confirmationStatus.declinedAt && (
          <div className="text-sm text-red-700 bg-red-50 p-2 rounded mb-4">
            <p>
              {t.bookings.declinedAt}:{' '}
              {format(new Date(booking.confirmationStatus.declinedAt), 'PPp', {
                locale: dateLocale,
              })}{' '}
              ({booking.confirmationStatus.declinedBy === 'email_token'
                ? t.bookings.viaEmail
                : t.bookings.viaPortal}
              )
            </p>
            {booking.confirmationStatus.declineReason && (
              <p className="mt-1">
                {t.bookings.declineReason}: {booking.confirmationStatus.declineReason}
              </p>
            )}
            {booking.confirmationStatus.declineNotes && (
              <p className="mt-1 italic">{booking.confirmationStatus.declineNotes}</p>
            )}
          </div>
        )}

        {/* Actions for pending bookings */}
        {isPending && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isConfirming ? t.bookings.confirming : t.bookings.confirm}
            </Button>
            <Button
              variant="destructive"
              onClick={onDecline}
              disabled={isConfirming}
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t.bookings.decline}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, notes?: string) => void;
  isLoading: boolean;
  reasons: DeclineReason[];
  t: ReturnType<typeof useI18n>['t'];
  locale: string;
}

function DeclineModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  reasons,
  t,
  locale,
}: DeclineModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');

  const selectedReasonObj = reasons.find((r) => r.code === selectedReason);
  const requiresNotes = selectedReasonObj?.requiresNotes;
  const canSubmit = selectedReason && (!requiresNotes || notes.trim());

  const handleSubmit = () => {
    if (canSubmit) {
      onConfirm(selectedReason, notes || undefined);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setNotes('');
    onClose();
  };

  const getReasonLabel = (reason: DeclineReason) => {
    switch (locale) {
      case 'de':
        return reason.labelDe;
      case 'uk':
        return reason.labelUk || reason.labelEn;
      default:
        return reason.labelEn;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t.bookings.declineTitle}
          </DialogTitle>
          <DialogDescription>{t.bookings.declineDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">{t.bookings.declineReason}</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder={t.bookings.selectReason} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {getReasonLabel(reason)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">
              {t.bookings.additionalNotes}
              {requiresNotes && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.bookings.notesPlaceholder}
              rows={3}
            />
            {requiresNotes && !notes.trim() && selectedReason && (
              <p className="text-sm text-destructive">{t.bookings.notesRequired}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t.bookings.cancelDecline}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? t.bookings.declining : t.bookings.confirmDecline}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const dateLocale = getDateLocale(locale);

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [declineBooking, setDeclineBooking] = useState<Booking | null>(null);

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['bookings', user?.id, filter],
    queryFn: () =>
      api.getBookings({
        status: filter === 'all' ? undefined : filter,
      }),
    enabled: hasHydrated && !!user,
  });

  const confirmMutation = useMutation({
    mutationFn: (bookingId: number) => api.confirmBooking(bookingId),
    onSuccess: () => {
      toast.success(t.bookings.confirmSuccess);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => {
      toast.error(t.bookings.confirmError);
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({
      bookingId,
      reasonCode,
      notes,
    }: {
      bookingId: number;
      reasonCode: string;
      notes?: string;
    }) => api.declineBooking(bookingId, reasonCode, notes),
    onSuccess: () => {
      toast.success(t.bookings.declineSuccess);
      setDeclineBooking(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => {
      toast.error(t.bookings.declineError);
    },
  });

  const handleConfirm = (booking: Booking) => {
    confirmMutation.mutate(booking.id);
  };

  const handleDeclineSubmit = (reasonCode: string, notes?: string) => {
    if (declineBooking) {
      declineMutation.mutate({
        bookingId: declineBooking.id,
        reasonCode,
        notes,
      });
    }
  };

  if (!hasHydrated) {
    return null;
  }

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const bookings = data?.bookings ?? [];
  const stats = data?.stats ?? { pending: 0, confirmed: 0, declined: 0, total: 0 };
  const declineReasons = data?.declineReasons ?? [];

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const otherBookings = bookings.filter((b) => b.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.bookings.title}</h1>
          <p className="text-muted-foreground">{t.bookings.description}</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t.common.refresh}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.bookings.pendingCount}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.bookings.confirmedCount}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.bookings.declinedCount}
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.bookings.totalCount}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'confirmed', 'declined'] as FilterStatus[]).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === 'all' && t.bookings.filterAll}
            {status === 'pending' && t.bookings.filterPending}
            {status === 'confirmed' && t.bookings.filterConfirmed}
            {status === 'declined' && t.bookings.filterDeclined}
          </Button>
        ))}
      </div>

      {/* No bookings message */}
      {bookings.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">{t.bookings.noBookings}</p>
            <p className="text-muted-foreground">{t.bookings.noBookingsDesc}</p>
          </CardContent>
        </Card>
      )}

      {/* Pending Bookings Section */}
      {filter === 'all' && pendingBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t.bookings.needsConfirmation} ({pendingBookings.length})
          </h2>
          <div className="space-y-4">
            {pendingBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                t={t}
                dateLocale={dateLocale}
                onConfirm={() => handleConfirm(booking)}
                onDecline={() => setDeclineBooking(booking)}
                isConfirming={confirmMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Bookings Section */}
      {filter === 'all' && otherBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t.bookings.allBookings}</h2>
          <div className="space-y-4">
            {otherBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                t={t}
                dateLocale={dateLocale}
                onConfirm={() => handleConfirm(booking)}
                onDecline={() => setDeclineBooking(booking)}
                isConfirming={confirmMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filtered Bookings */}
      {filter !== 'all' && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              t={t}
              dateLocale={dateLocale}
              onConfirm={() => handleConfirm(booking)}
              onDecline={() => setDeclineBooking(booking)}
              isConfirming={confirmMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Decline Modal */}
      <DeclineModal
        isOpen={!!declineBooking}
        onClose={() => setDeclineBooking(null)}
        onConfirm={handleDeclineSubmit}
        isLoading={declineMutation.isPending}
        reasons={declineReasons}
        t={t}
        locale={locale}
      />
    </div>
  );
}
