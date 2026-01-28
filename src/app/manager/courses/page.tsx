'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  ExternalLink,
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
import { ManagerCourse } from '@/lib/types';

function CourseRow({
  course,
  t,
}: {
  course: ManagerCourse;
  t: Record<string, Record<string, unknown>>;
}) {
  const managerCourses = t.managerCourses as Record<string, string> | undefined;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="max-w-[300px]">
          <Link
            href={`/manager/courses/${course.id}`}
            className="font-medium hover:underline line-clamp-1"
          >
            {course.title}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{course.sku}</p>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{course.partnerName}</p>
          <p className="text-xs text-muted-foreground truncate">{course.partnerEmail}</p>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {course.location || '-'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={
          course.status === 'active'
            ? 'border-green-500 text-green-700'
            : 'border-gray-500 text-gray-600'
        }>
          {course.status === 'active'
            ? (managerCourses?.active || 'Active')
            : (managerCourses?.inactive || 'Inactive')}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {course.available_dates ?? 0}
      </TableCell>
      <TableCell className="text-right">
        €{Number(course.basePrice).toFixed(2)}
      </TableCell>
      <TableCell>
        <Link href={`/manager/courses/${course.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}

export default function ManagerCoursesPage() {
  const { t } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const managerCourses = t.managerCourses as Record<string, string> | undefined;

  // Filter state
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [availableDatesRange, setAvailableDatesRange] = useState<'none' | '1-5' | '5+' | ''>('');
  const [dateRangeType, setDateRangeType] = useState<'next7d' | 'next30d' | 'custom' | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  // Fetch locations for dropdown
  const { data: locationsData } = useQuery({
    queryKey: ['course-locations'],
    queryFn: () => api.getCourseLocations(),
    enabled: hasHydrated,
  });

  // Fetch courses with filters
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'manager-courses',
      search,
      location,
      availableDatesRange,
      dateRangeType,
      dateFrom,
      dateTo,
      status,
      currentPage,
    ],
    queryFn: () =>
      api.getManagerCourses({
        search: search || undefined,
        location: location || undefined,
        availableDatesRange: availableDatesRange || undefined,
        dateRangeType: dateRangeType || undefined,
        dateFrom: dateRangeType === 'custom' ? dateFrom : undefined,
        dateTo: dateRangeType === 'custom' ? dateTo : undefined,
        status: status || undefined,
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
    enabled: hasHydrated,
  });

  const handleResetFilters = () => {
    setSearch('');
    setLocation('');
    setAvailableDatesRange('');
    setDateRangeType('');
    setDateFrom('');
    setDateTo('');
    setStatus('');
    setCurrentPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const courses = data?.courses || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{managerCourses?.title || 'Course Management'}</h1>
          <p className="text-muted-foreground">
            {managerCourses?.description || 'Manage all partner courses'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {(t.common?.refresh as string) || 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {(t.common?.filters as string) || 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Partner Search */}
            <div className="space-y-2">
              <Label>{managerCourses?.searchPartner || 'Search partner'}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={managerCourses?.searchPlaceholder || 'Name, email or customer number...'}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>{managerCourses?.location || 'Location'}</Label>
              <Select
                value={location}
                onValueChange={(v) => {
                  setLocation(v === 'all' ? '' : v);
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={managerCourses?.allLocations || 'All Locations'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{managerCourses?.allLocations || 'All Locations'}</SelectItem>
                  {locationsData?.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Available Dates Range */}
            <div className="space-y-2">
              <Label>{managerCourses?.availableDates || 'Available Dates'}</Label>
              <Select
                value={availableDatesRange}
                onValueChange={(v) => {
                  setAvailableDatesRange(v === 'all' ? '' : (v as 'none' | '1-5' | '5+'));
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={managerCourses?.allDates || 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{managerCourses?.allDates || 'All'}</SelectItem>
                  <SelectItem value="none">{managerCourses?.noDates || 'No Dates'}</SelectItem>
                  <SelectItem value="1-5">{managerCourses?.oneToFiveDates || '1-5 Dates'}</SelectItem>
                  <SelectItem value="5+">{managerCourses?.moreThanFiveDates || '5+ Dates'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Type */}
            <div className="space-y-2">
              <Label>{managerCourses?.dateRange || 'Date Range'}</Label>
              <Select
                value={dateRangeType}
                onValueChange={(v) => {
                  setDateRangeType(v === 'all' ? '' : (v as 'next7d' | 'next30d' | 'custom'));
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={managerCourses?.allTime || 'All Time'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{managerCourses?.allTime || 'All Time'}</SelectItem>
                  <SelectItem value="next7d">{managerCourses?.next7Days || 'Next 7 Days'}</SelectItem>
                  <SelectItem value="next30d">{managerCourses?.next30Days || 'Next 30 Days'}</SelectItem>
                  <SelectItem value="custom">{managerCourses?.customRange || 'Custom'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateRangeType === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>{managerCourses?.from || 'From'}</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(0);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{managerCourses?.to || 'To'}</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(0);
                    }}
                  />
                </div>
              </>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>{managerCourses?.status || 'Status'}</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v === 'all' ? '' : (v as 'active' | 'inactive'));
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={managerCourses?.allStatuses || 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{managerCourses?.allStatuses || 'All'}</SelectItem>
                  <SelectItem value="active">{managerCourses?.active || 'Active'}</SelectItem>
                  <SelectItem value="inactive">{managerCourses?.inactive || 'Inactive'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            <div className="space-y-2 flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                {(t.common?.reset as string) || 'Reset'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Courses Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {managerCourses?.course || 'Courses'} ({data?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{(t.common?.loading as string) || 'Loading...'}</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground">{managerCourses?.noCourses || 'No courses found'}</p>
                <p className="text-sm text-muted-foreground">{managerCourses?.noCoursesDesc || 'There are no courses for the selected filters.'}</p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{managerCourses?.course || 'Course'}</TableHead>
                    <TableHead>{managerCourses?.partner || 'Partner'}</TableHead>
                    <TableHead>{managerCourses?.location || 'Location'}</TableHead>
                    <TableHead>{managerCourses?.status || 'Status'}</TableHead>
                    <TableHead className="text-right">{managerCourses?.dates || 'Dates'}</TableHead>
                    <TableHead className="text-right">{managerCourses?.price || 'Price'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <CourseRow key={course.id} course={course} t={t} />
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {managerCourses?.page || 'Page'} {currentPage + 1} {managerCourses?.of || 'of'} {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {(t.common?.previous as string) || 'Previous'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!data?.pagination.hasMore}
                    >
                      {(t.common?.next as string) || 'Next'}
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
