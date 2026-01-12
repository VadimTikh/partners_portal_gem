'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { CourseRequestStatus, CreateCourseFromRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const createCourseSchema = z.object({
  name: z.string().min(3, 'Title is required'),
  subtitle: z.string().min(3, 'Subtitle is required'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  shortDescription: z.string().min(20, 'Short description must be at least 20 characters'),
  beginTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  seats: z.string().min(1, 'Capacity is required'),
  participants: z.string().min(1, 'Participants text is required'),
  categoryIds: z.string().min(1, 'At least one category is required'),
  keyword: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  image: z.string().optional(),
});

type CreateCourseFormData = z.infer<typeof createCourseSchema>;

const getStatusBadge = (status: CourseRequestStatus, t: ReturnType<typeof useI18n>['t']) => {
  const statusConfig = {
    pending: {
      label: t.requests.statusPending,
      variant: 'secondary' as const,
      icon: Clock,
    },
    in_moderation: {
      label: t.requests.statusInModeration,
      variant: 'default' as const,
      icon: AlertCircle,
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionRecommendations, setRejectionRecommendations] = useState('');
  const [managerNotes, setManagerNotes] = useState('');

  const requestId = Number(params.id);

  const { data: request, isLoading } = useQuery({
    queryKey: ['course-request', requestId],
    queryFn: () => api.getCourseRequest(requestId),
    enabled: !!requestId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCourseFormData>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      name: '',
      subtitle: '',
      description: '',
      shortDescription: '',
      beginTime: '18:00',
      endTime: '21:00',
      seats: '10',
      participants: '2-10 Personen',
      categoryIds: '',
    },
  });

  // Pre-fill form with request data when loaded
  useEffect(() => {
    if (request) {
      reset({
        name: request.name || '',
        subtitle: '',
        description: '',
        shortDescription: request.partnerDescription || '',
        beginTime: '18:00',
        endTime: '21:00',
        seats: '10',
        participants: '2-10 Personen',
        categoryIds: '',
      });
    }
  }, [request, reset]);

  const updateStatusMutation = useMutation({
    mutationFn: ({
      status,
      data,
    }: {
      status: 'in_moderation' | 'approved' | 'rejected';
      data?: { rejectionReason?: string; rejectionRecommendations?: string; managerNotes?: string };
    }) => api.updateCourseRequestStatus(requestId, status, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['all-course-requests'] });
      toast.success(t.manager.statusUpdated);
      setShowRejectDialog(false);
    },
    onError: () => {
      toast.error(t.manager.statusUpdateError);
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: (data: CreateCourseFromRequest) => api.createCourseFromRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['all-course-requests'] });
      toast.success(t.manager.courseCreated);
      setShowCreateDialog(false);
      router.push('/manager/requests');
    },
    onError: () => {
      toast.error(t.manager.courseCreateError);
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

  const onCreateCourse = (data: CreateCourseFormData) => {
    createCourseMutation.mutate({
      requestId,
      ...data,
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
          <h1 className="text-2xl font-bold">{request.name}</h1>
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
              <span>{request.partnerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{request.partnerEmail}</span>
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
              <span>{request.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span>{request.basePrice.toFixed(2)} €</span>
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
          <p className="whitespace-pre-wrap">{request.partnerDescription}</p>
        </CardContent>
      </Card>

      {/* Requested Dates */}
      {request.requestedDates && request.requestedDates.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.requestedDates}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {request.requestedDates.map((date, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(date.dateTime), 'PPP', { locale: dateLocale })}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(date.dateTime), 'HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{date.duration} min</span>
                    <span>{date.capacity} Plätze</span>
                    {date.customPrice && <span>{date.customPrice.toFixed(2)} €</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager Notes */}
      {request.status !== 'approved' && request.status !== 'rejected' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.managerNotes}</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t.manager.managerNotesPlaceholder}
              value={managerNotes || request.managerNotes || ''}
              onChange={(e) => setManagerNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Rejection Info (if rejected) */}
      {request.status === 'rejected' && (
        <Card className="mt-6 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">{t.requests.rejectionReason}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{request.rejectionReason}</p>
            {request.rejectionRecommendations && (
              <>
                <h4 className="font-medium">{t.requests.recommendations}</h4>
                <p>{request.rejectionRecommendations}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="flex gap-4 mt-6">
          <Button onClick={handleTakeInModeration} disabled={updateStatusMutation.isPending}>
            {t.manager.takeInModeration}
          </Button>
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
            {t.manager.rejectRequest}
          </Button>
        </div>
      )}

      {request.status === 'in_moderation' && (
        <div className="flex gap-4 mt-6">
          <Button onClick={() => setShowCreateDialog(true)}>{t.manager.createCourse}</Button>
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
            {t.manager.rejectRequest}
          </Button>
        </div>
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

      {/* Create Course Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.manager.createCourseTitle}</DialogTitle>
            <DialogDescription>{t.manager.createCourseDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateCourse)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Course Title (from partner, editable) */}
              <div className="col-span-2 space-y-2">
                <Label>{t.manager.courseTitleLabel}</Label>
                <Input {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">{t.manager.courseTitleHint}</p>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>{t.manager.subtitleLabel}</Label>
                <Input placeholder={t.manager.subtitlePlaceholder} {...register('subtitle')} />
                {errors.subtitle && (
                  <p className="text-sm text-destructive">{errors.subtitle.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label>{t.manager.fullDescriptionLabel}</Label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label>{t.manager.shortDescriptionLabel}</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register('shortDescription')}
                />
                {errors.shortDescription && (
                  <p className="text-sm text-destructive">{errors.shortDescription.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.manager.beginTimeLabel}</Label>
                <Input type="time" {...register('beginTime')} />
                {errors.beginTime && (
                  <p className="text-sm text-destructive">{errors.beginTime.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.manager.endTimeLabel}</Label>
                <Input type="time" {...register('endTime')} />
                {errors.endTime && (
                  <p className="text-sm text-destructive">{errors.endTime.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.manager.seatsLabel}</Label>
                <Input type="number" {...register('seats')} />
                {errors.seats && (
                  <p className="text-sm text-destructive">{errors.seats.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.manager.participantsLabel}</Label>
                <Input placeholder={t.manager.participantsPlaceholder} {...register('participants')} />
                {errors.participants && (
                  <p className="text-sm text-destructive">{errors.participants.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label>{t.manager.categoryIdsLabel}</Label>
                <Input placeholder={t.manager.categoryIdsPlaceholder} {...register('categoryIds')} />
                {errors.categoryIds && (
                  <p className="text-sm text-destructive">{errors.categoryIds.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={createCourseMutation.isPending}>
                {createCourseMutation.isPending
                  ? t.manager.publishing
                  : t.manager.publishCourse}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
