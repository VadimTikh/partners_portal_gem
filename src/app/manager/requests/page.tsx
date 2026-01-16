'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import Link from 'next/link';
import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { CourseRequest, CourseRequestStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export default function ManagerRequestsPage() {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const dateLocale = locale === 'de' ? de : enUS;

  const { data: requests, isLoading } = useQuery({
    queryKey: ['all-course-requests'],
    queryFn: () => api.getAllCourseRequests(),
    enabled: hasHydrated,
  });

  const filteredRequests = requests?.filter((request: CourseRequest) => {
    const search = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (request.name?.toLowerCase().includes(search)) ||
      (request.partnerName?.toLowerCase().includes(search)) ||
      (request.location?.toLowerCase().includes(search));

    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  // Sort by status priority: pending first, then in_moderation, then others
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const statusOrder = { pending: 0, in_moderation: 1, approved: 2, rejected: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t.manager.requestsTitle}</h1>
        <p className="text-muted-foreground">{t.manager.requestsDescription}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t.common.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.manager.filterAll}</SelectItem>
            <SelectItem value="pending">{t.manager.filterPending}</SelectItem>
            <SelectItem value="in_moderation">{t.manager.filterInModeration}</SelectItem>
            <SelectItem value="approved">{t.requests.statusApproved}</SelectItem>
            <SelectItem value="rejected">{t.requests.statusRejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">{t.manager.noRequests}</p>
            <p className="text-muted-foreground">{t.manager.noRequestsDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedRequests.map((request: CourseRequest) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{request.name || '-'}</CardTitle>
                    <CardDescription className="mt-1">
                      {request.partnerName || '-'} &middot; {request.location || '-'} &middot;{' '}
                      {(request.basePrice ?? 0).toFixed(2)} €
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status, t)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 break-words overflow-hidden">
                  {request.partnerDescription || '-'}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span>
                      {t.requests.submittedOn}{' '}
                      {format(new Date(request.createdAt), 'PPP', { locale: dateLocale })}
                    </span>
                    {request.requestedDates && request.requestedDates.length > 0 && (
                      <span className="ml-4">
                        {request.requestedDates.length} {t.courseRequest.datesSection.toLowerCase()}
                      </span>
                    )}
                  </div>

                  <Link href={`/manager/requests/${request.id}`}>
                    <Button variant="outline" size="sm">
                      {t.common.view}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
