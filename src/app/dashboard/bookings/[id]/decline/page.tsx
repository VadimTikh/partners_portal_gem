'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth';
import { DeclineReason } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export default function DeclineBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const bookingId = params.id as string;
  const token = searchParams.get('token');

  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Fetch bookings to get decline reasons
  const { data, isLoading } = useQuery({
    queryKey: ['bookings', user?.id],
    queryFn: () => api.getBookings({}),
    enabled: hasHydrated && !!user,
  });

  const declineReasons = data?.declineReasons ?? [];

  const selectedReasonObj = declineReasons.find((r: DeclineReason) => r.code === selectedReason);
  const requiresNotes = selectedReasonObj?.requiresNotes;
  const canSubmit = selectedReason && (!requiresNotes || notes.trim());

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
      setIsComplete(true);
    },
    onError: () => {
      toast.error(t.bookings.declineError);
    },
  });

  const handleSubmit = () => {
    if (canSubmit) {
      declineMutation.mutate({
        bookingId: parseInt(bookingId, 10),
        reasonCode: selectedReason,
        notes: notes || undefined,
      });
    }
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (hasHydrated && !user) {
      const currentPath = `/dashboard/bookings/${bookingId}/decline${token ? `?token=${token}` : ''}`;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [hasHydrated, user, router, bookingId, token]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  // Success state
  if (isComplete) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <CardTitle>{t.bookings.declineSuccess}</CardTitle>
            <CardDescription>
              {locale === 'de'
                ? 'Die Buchung wurde erfolgreich abgelehnt.'
                : 'The booking has been successfully declined.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => router.push('/dashboard/bookings')}
            >
              {locale === 'de' ? 'Zurück zu Buchungen' : 'Back to Bookings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>{t.bookings.declineTitle}</CardTitle>
          </div>
          <CardDescription>{t.bookings.declineDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">{t.bookings.declineReason}</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder={t.bookings.selectReason} />
              </SelectTrigger>
              <SelectContent>
                {declineReasons.map((reason: DeclineReason) => (
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

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/dashboard/bookings')}
              disabled={declineMutation.isPending}
            >
              {t.bookings.cancelDecline}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canSubmit || declineMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {declineMutation.isPending ? t.bookings.declining : t.bookings.confirmDecline}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
