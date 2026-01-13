'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import Link from 'next/link';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth';
import { CourseRequest, CourseRequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function RequestsPage() {
  const { t, locale } = useI18n();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const dateLocale = locale === 'de' ? de : enUS;

  const { data: requests, isLoading } = useQuery({
    queryKey: ['course-requests', user?.partnerId],
    queryFn: () => api.getCourseRequests(),
    enabled: hasHydrated && !!user?.partnerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.requests.title}</h1>
        </div>
        <Link href="/dashboard/request/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t.common.addNewCourse}
          </Button>
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium mb-2">{t.requests.noRequests}</p>
            <p className="text-muted-foreground mb-4">{t.requests.noRequestsDesc}</p>
            <Link href="/dashboard/request/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t.requests.createFirst}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request: CourseRequest) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{request.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {request.location} &middot; {request.basePrice.toFixed(2)} €
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status, t)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {request.partnerDescription}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t.requests.submittedOn}{' '}
                    {format(new Date(request.createdAt), 'PPP', { locale: dateLocale })}
                  </span>

                  {request.status === 'approved' && request.createdCourseId && (
                    <Link href={`/dashboard/editor/${request.createdCourseId}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t.requests.viewCourse}
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Show rejection details */}
                {request.status === 'rejected' && (
                  <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="font-medium text-sm text-destructive mb-2">
                      {t.requests.rejectionReason}
                    </p>
                    <p className="text-sm">{request.rejectionReason}</p>

                    {request.rejectionRecommendations && (
                      <>
                        <p className="font-medium text-sm mt-3 mb-2">{t.requests.recommendations}</p>
                        <p className="text-sm">{request.rejectionRecommendations}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Show requested dates if any */}
                {request.requestedDates && request.requestedDates.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">
                      {t.courseRequest.datesSection} ({request.requestedDates.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {request.requestedDates.map((date, idx) => (
                        <Badge key={idx} variant="outline">
                          {format(new Date(date.dateTime), 'PPP', { locale: dateLocale })} -{' '}
                          {format(new Date(date.dateTime), 'HH:mm')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
