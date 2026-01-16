'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS, uk } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Server,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { AppLog, AppLogStatus } from '@/lib/types';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const statusConfig: Record<AppLogStatus, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  success: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100 text-green-800' },
  error: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100 text-red-800' },
  validation_error: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100 text-yellow-800' },
};

function LogRow({ log }: { log: AppLog }) {
  const [isOpen, setIsOpen] = useState(false);
  const { locale } = useI18n();
  const dateLocale = locale === 'de' ? de : locale === 'uk' ? uk : enUS;

  const config = statusConfig[log.status];
  const Icon = config.icon;
  const hasDetails = log.errorMessage || log.errorStack || log.requestBody || log.responseSummary;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className={log.status !== 'success' ? 'bg-red-50/50' : ''}>
        <TableCell className="whitespace-nowrap">
          {format(new Date(log.timestamp), 'PPp', { locale: dateLocale })}
        </TableCell>
        <TableCell>
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.action}</code>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-mono text-xs">{log.method}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{log.endpoint}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={config.bgColor}>
            <Icon className="mr-1 h-3 w-3" />
            {log.status.replace('_', ' ')}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <span className={log.durationMs > 1000 ? 'text-yellow-600 font-medium' : ''}>
            {log.durationMs}ms
          </span>
        </TableCell>
        <TableCell>
          {log.userEmail ? (
            <span className="text-xs text-muted-foreground">{log.userEmail}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          )}
        </TableCell>
      </TableRow>
      {hasDetails && (
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30">
            <TableCell colSpan={7} className="py-4">
              <div className="space-y-3 text-sm">
                {log.errorMessage && (
                  <div>
                    <span className="font-medium text-red-600">Error: </span>
                    <span className="text-red-700">{log.errorMessage}</span>
                    {log.errorCode && (
                      <code className="ml-2 text-xs bg-red-100 px-1 py-0.5 rounded">{log.errorCode}</code>
                    )}
                  </div>
                )}
                {log.errorStack && (
                  <div>
                    <span className="font-medium">Stack Trace:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                      {log.errorStack}
                    </pre>
                  </div>
                )}
                {log.requestBody && Object.keys(log.requestBody).length > 0 && (
                  <div>
                    <span className="font-medium">Request Body:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.requestBody, null, 2)}
                    </pre>
                  </div>
                )}
                {log.responseSummary && Object.keys(log.responseSummary).length > 0 && (
                  <div>
                    <span className="font-medium">Response Summary:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.responseSummary, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Status Code: {log.statusCode}</span>
                  {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                  {log.userId && <span>User ID: {log.userId}</span>}
                </div>
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default function AppLogsPage() {
  const { t, locale } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // Filter state
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['app-logs', selectedStatus, selectedAction, startDate, endDate, currentPage],
    queryFn: () => api.getAppLogs({
      status: selectedStatus !== 'all' ? selectedStatus as AppLogStatus | 'all_errors' : undefined,
      action: selectedAction !== 'all' ? selectedAction : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: pageSize,
      offset: currentPage * pageSize,
    }),
    enabled: hasHydrated,
  });

  const handleResetFilters = () => {
    setSelectedStatus('all');
    setSelectedAction('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.manager.appLogs || 'App Logs'}</h1>
          <p className="text-muted-foreground">{t.manager.appLogsDesc || 'Monitor API operations and errors'}</p>
        </div>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t.manager.totalOperations || 'Total Operations'}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{data.stats.totalLogs.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">{t.common.success || 'Success'}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">{data.stats.successCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">{t.manager.errors || 'Errors'}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-red-600">{data.stats.errorCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-muted-foreground">{t.manager.last24hErrors || 'Errors (24h)'}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-orange-600">{data.stats.last24hErrors.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

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
              <Label>{t.common.status || 'Status'}</Label>
              <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.manager.allStatuses || 'All Statuses'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.manager.allStatuses || 'All'}</SelectItem>
                  <SelectItem value="all_errors">{t.manager.errorsOnly || 'Errors Only'}</SelectItem>
                  <SelectItem value="success">{t.common.success || 'Success'}</SelectItem>
                  <SelectItem value="error">{t.common.error || 'Error'}</SelectItem>
                  <SelectItem value="validation_error">{t.manager.validationError || 'Validation Error'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.manager.action || 'Action'}</Label>
              <Select value={selectedAction} onValueChange={(v) => { setSelectedAction(v); setCurrentPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.manager.allActions || 'All Actions'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.manager.allActions || 'All Actions'}</SelectItem>
                  {data?.actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
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
              <p className="text-muted-foreground">{t.manager.noAppLogs || 'No app logs found'}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.manager.dateTime || 'Date/Time'}</TableHead>
                    <TableHead>{t.manager.action || 'Action'}</TableHead>
                    <TableHead>{t.manager.endpoint || 'Endpoint'}</TableHead>
                    <TableHead>{t.common.status || 'Status'}</TableHead>
                    <TableHead className="text-right">{t.manager.duration || 'Duration'}</TableHead>
                    <TableHead>{t.manager.user || 'User'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <LogRow key={log.id} log={log} />
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
