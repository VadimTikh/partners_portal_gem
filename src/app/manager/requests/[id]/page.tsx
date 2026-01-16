'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Euro,
  User,
  Mail,
  Users,
  Timer,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { CourseRequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const getStatusBadge = (status: CourseRequestStatus, t: ReturnType<typeof useI18n>['t']) => {
  const statusConfig = {
    pending: {
      label: t.requests.statusPending,
      variant: 'secondary' as const,
      icon: Clock,
      className: undefined as string | undefined,
    },
    in_moderation: {
      label: t.requests.statusInModeration,
      variant: 'default' as const,
      icon: AlertCircle,
      className: undefined as string | undefined,
    },
    approved: {
      label: t.requests.statusApproved,
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-500 hover:bg-green-600',
    },
    rejected: {
      label: t.requests.statusRejected,
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

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();
  const dateLocale = locale === 'de' ? de : enUS;

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionRecommendations, setRejectionRecommendations] = useState('');
  const [managerNotes, setManagerNotes] = useState('');

  const requestId = Number(params.id);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const { data: request, isLoading } = useQuery({
    queryKey: ['course-request', requestId],
    queryFn: () => api.getManagerCourseRequest(requestId),
    enabled: hasHydrated && !!requestId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      status,
      data,
    }: {
      status: 'in_moderation' | 'approved' | 'rejected';
      data?: { rejectionReason?: string; rejectionRecommendations?: string; managerNotes?: string };
    }) => api.updateCourseRequestStatus(requestId, status, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['all-course-requests'] });

      if (variables.status === 'approved') {
        toast.success(t.manager.courseCreated);
        router.push('/manager/requests');
      } else {
        toast.success(t.manager.statusUpdated);
      }

      setShowRejectDialog(false);
      setShowApproveDialog(false);
    },
    onError: () => {
      toast.error(t.manager.statusUpdateError);
    },
  });

  const handleTakeInModeration = () => {
    updateStatusMutation.mutate({
      status: 'in_moderation',
      data: { managerNotes },
    });
  };

  const handleReject = () => {
    updateStatusMutation.mutate({
      status: 'rejected',
      data: {
        rejectionReason,
        rejectionRecommendations,
      },
    });
  };

  const handleCourseCreated = () => {
    updateStatusMutation.mutate({
      status: 'approved',
      data: { managerNotes },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Request not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/manager/requests"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.common.back}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{request.name || '-'}</h1>
          <p className="text-muted-foreground mt-1">
            {t.requests.submittedOn}{' '}
            {format(new Date(request.createdAt), 'PPP', { locale: dateLocale })}
          </p>
        </div>
        {getStatusBadge(request.status, t)}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Partner Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.partnerInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{request.partnerName || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{request.partnerEmail || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Course Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.courseInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{request.location || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span>{(request.basePrice ?? 0).toFixed(2)} €</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">{t.courseRequest.descriptionLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words">{request.partnerDescription || '-'}</p>
        </CardContent>
      </Card>

      {/* Requested Dates */}
      {request.requestedDates && request.requestedDates.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.requestedDates}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.requestedDates.map((date, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-4 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(date.dateTime), 'PPP', { locale: dateLocale })}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(date.dateTime), 'HH:mm')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground ml-8">
                    <div className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      <span>{date.duration} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{date.capacity} {t.manager.seats}</span>
                    </div>
                    {date.customPrice && (
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        <span>{date.customPrice.toFixed(2)} €</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection Info (if rejected) */}
      {request.status === 'rejected' && (
        <Card className="mt-6 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              {t.requests.rejectionReason}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{request.rejectionReason}</p>
            {request.rejectionRecommendations && (
              <>
                <h4 className="font-medium text-sm">{t.requests.recommendations}</h4>
                <p className="text-sm text-muted-foreground">{request.rejectionRecommendations}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approved Info */}
      {request.status === 'approved' && (
        <Card className="mt-6 border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="text-lg text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              {t.requests.statusApproved}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t.manager.courseCreatedSuccess}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending Actions */}
      {request.status === 'pending' && (
        <Card className="mt-6 border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              {t.requests.statusPending}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.manager.pendingDescription}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.manager.managerNotes}</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder={t.manager.managerNotesPlaceholder}
                  value={managerNotes || request.managerNotes || ''}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleTakeInModeration}
                disabled={updateStatusMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                {t.manager.takeInModeration}
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                {t.manager.rejectRequest}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In Moderation Actions */}
      {request.status === 'in_moderation' && (
        <Card className="mt-6 border-blue-500/50 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              {t.requests.statusInModeration}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.manager.inModerationDescription}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.manager.managerNotes}</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder={t.manager.managerNotesPlaceholder}
                  value={managerNotes || request.managerNotes || ''}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowApproveDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.manager.courseCreatedBtn}
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                {t.manager.rejectRequest}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.manager.rejectRequest}</DialogTitle>
            <DialogDescription>
              {t.manager.rejectionReasonPlaceholder}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.manager.rejectionReasonLabel}</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t.manager.rejectionReasonPlaceholder}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.manager.recommendationsLabel}</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t.manager.recommendationsPlaceholder}
                value={rejectionRecommendations}
                onChange={(e) => setRejectionRecommendations(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason || updateStatusMutation.isPending}
            >
              {t.manager.confirmReject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Course Created Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.manager.confirmCourseCreated}</DialogTitle>
            <DialogDescription>
              {t.manager.confirmCourseCreatedDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleCourseCreated}
              disabled={updateStatusMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t.manager.confirmApprove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
