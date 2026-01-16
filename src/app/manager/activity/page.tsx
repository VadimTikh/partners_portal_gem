'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import {
  Activity,
  FileText,
  Calendar,
  PenSquare,
  Trash2,
  Key,
  KeyRound,
  LogIn,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
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

interface ActivityLog {
  id: number;
  userId: string;
  partnerEmail: string;
  partnerName: string;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  details: Record<string, unknown> | null;
  customerNumber: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const actionTypeConfig: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  course_request_created: { icon: FileText, color: 'bg-green-500', label: 'Course Request Created' },
  date_added: { icon: Calendar, color: 'bg-blue-500', label: 'Date Added' },
  date_edited: { icon: PenSquare, color: 'bg-yellow-500', label: 'Date Edited' },
  date_deleted: { icon: Trash2, color: 'bg-red-500', label: 'Date Deleted' },
  password_changed: { icon: Key, color: 'bg-purple-500', label: 'Password Changed' },
  password_reset_requested: { icon: KeyRound, color: 'bg-orange-500', label: 'Password Reset Requested' },
  password_reset_completed: { icon: KeyRound, color: 'bg-orange-500', label: 'Password Reset Completed' },
  login: { icon: LogIn, color: 'bg-gray-500', label: 'Login' },
};

export default function ActivityLogsPage() {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'de' ? de : enUS;
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // Filter state
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', selectedPartner, selectedActionType, startDate, endDate, currentPage],
    queryFn: () => api.getActivityLogs({
      userId: selectedPartner !== 'all' ? selectedPartner : undefined,
      actionType: selectedActionType !== 'all' ? selectedActionType : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: pageSize,
      offset: currentPage * pageSize,
    }),
    enabled: hasHydrated,
  });

  const handleResetFilters = () => {
    setSelectedPartner('all');
    setSelectedActionType('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(0);
  };

  const getActionBadge = (actionType: string) => {
    const config = actionTypeConfig[actionType] || { icon: Activity, color: 'bg-gray-500', label: actionType };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDetails = (log: ActivityLog): string => {
    if (!log.details) return '-';

    const parts: string[] = [];

    if (log.details.courseName) {
      parts.push(`Course: ${log.details.courseName}`);
    }

    if (log.details.courseId) {
      parts.push(`Course ID: ${log.details.courseId}`);
    }

    if (log.details.dateTime) {
      parts.push(`DateTime: ${log.details.dateTime}`);
    }

    if (log.details.changedFields && typeof log.details.changedFields === 'object') {
      const fields = Object.keys(log.details.changedFields as Record<string, unknown>);
      parts.push(`Changed: ${fields.join(', ')}`);
    }

    return parts.length > 0 ? parts.join(' | ') : '-';
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.manager.activityLogs || 'Activity Logs'}</h1>
          <p className="text-muted-foreground">{t.manager.activityLogsDesc || 'Track partner activities and actions'}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t.common.filters || 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>{t.manager.partner || 'Partner'}</Label>
              <Select value={selectedPartner} onValueChange={(v) => { setSelectedPartner(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.manager.allPartners || 'All Partners'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.manager.allPartners || 'All Partners'}</SelectItem>
                  {data?.partners.map((partner) => (
                    <SelectItem key={partner.userId} value={partner.userId}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.manager.actionType || 'Action Type'}</Label>
              <Select value={selectedActionType} onValueChange={(v) => { setSelectedActionType(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.manager.allActions || 'All Actions'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.manager.allActions || 'All Actions'}</SelectItem>
                  {Object.entries(actionTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.manager.startDate || 'Start Date'}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(0); }}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.manager.endDate || 'End Date'}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(0); }}
              />
            </div>

            <div className="space-y-2 flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                {t.common.reset || 'Reset'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {t.manager.results || 'Results'} ({data?.total || 0})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              {t.common.refresh || 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
          ) : !data?.logs.length ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{t.manager.noActivityLogs || 'No activity logs found'}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.manager.dateTime || 'Date/Time'}</TableHead>
                    <TableHead>{t.manager.partner || 'Partner'}</TableHead>
                    <TableHead>{t.manager.action || 'Action'}</TableHead>
                    <TableHead>{t.manager.details || 'Details'}</TableHead>
                    <TableHead>{t.manager.customerNumber || 'Customer #'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), 'PPp', { locale: dateLocale })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.partnerName}</span>
                          <span className="text-xs text-muted-foreground">{log.partnerEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.actionType)}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {formatDetails(log)}
                      </TableCell>
                      <TableCell>{log.customerNumber || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t.manager.page || 'Page'} {currentPage + 1} {t.manager.of || 'of'} {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t.common.previous || 'Previous'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!data.pagination.hasMore}
                    >
                      {t.common.next || 'Next'}
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
