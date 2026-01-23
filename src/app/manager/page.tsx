'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Users, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ManagerDashboardPage() {
  const { t } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const { data: partners } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.getPartners(),
    enabled: hasHydrated,
  });

  const { data: requests } = useQuery({
    queryKey: ['all-course-requests'],
    queryFn: () => api.getAllCourseRequests(),
    enabled: hasHydrated,
  });

  const pendingRequests = requests?.filter((r) => r.status === 'pending') || [];
  const inModerationRequests = requests?.filter((r) => r.status === 'in_moderation') || [];
  const approvedRequests = requests?.filter((r) => r.status === 'approved') || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t.manager.dashboard}</h1>

      {/* Partners Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.manager.partners}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partners?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Course Requests - combined stats and list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t.manager.courseRequests}
            </CardTitle>
            <CardDescription>{t.manager.requestsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status counts */}
            <div className="grid gap-2 grid-cols-3">
              <div className="flex flex-col items-center p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-lg font-bold text-yellow-600">{pendingRequests.length}</span>
                <span className="text-xs text-yellow-800">{t.requests.statusPending}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-lg font-bold text-blue-600">{inModerationRequests.length}</span>
                <span className="text-xs text-blue-800">{t.requests.statusInModeration}</span>
              </div>
              <div className="flex flex-col items-center p-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-lg font-bold text-green-600">{approvedRequests.length}</span>
                <span className="text-xs text-green-800">{t.requests.statusApproved}</span>
              </div>
            </div>

            {/* Recent pending requests */}
            {pendingRequests.length > 0 ? (
              <div className="space-y-2">
                {pendingRequests.slice(0, 3).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{req.name}</p>
                      <p className="text-sm text-muted-foreground">{req.partnerName}</p>
                    </div>
                    <Link href={`/manager/requests/${req.id}`}>
                      <Button variant="outline" size="sm">
                        {t.common.view}
                      </Button>
                    </Link>
                  </div>
                ))}
                <Link href="/manager/requests">
                  <Button variant="ghost" className="w-full">
                    {t.common.view} {t.manager.filterAll.toLowerCase()}
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {t.manager.noRequestsDesc}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.manager.allPartners}</CardTitle>
            <CardDescription>{t.manager.partnersDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {partners && partners.length > 0 ? (
              <div className="space-y-2">
                {partners.slice(0, 3).map((partner) => (
                  <div
                    key={partner.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{partner.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {partner.coursesCount} {t.manager.coursesCount}
                      </p>
                    </div>
                    <Link href={`/manager/partners/${partner.id}`}>
                      <Button variant="outline" size="sm">
                        {t.common.view}
                      </Button>
                    </Link>
                  </div>
                ))}
                {partners.length > 3 && (
                  <Link href="/manager/partners">
                    <Button variant="ghost" className="w-full">
                      {t.common.view} {t.manager.filterAll.toLowerCase()} ({partners.length})
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {t.manager.noPartners}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
