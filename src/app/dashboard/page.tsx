'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Edit, Package, AlertCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

export default function DashboardPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [datesFilter, setDatesFilter] = useState<'all' | 'with-dates' | 'without-dates'>('all');
  const { t } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const { data: courses, isLoading, error } = useQuery({
    queryKey: ['courses'],
    queryFn: api.getCourses,
    enabled: hasHydrated,
    retry: (failureCount, error) => {
      // Don't retry if it's a "not configured" error
      if (error instanceof Error && error.message.includes('not configured')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Check if error is about customer number not configured
  const isNotConfigured = error instanceof Error &&
    (error.message.includes('not configured') || error.message.includes('customer number'));

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  const filteredCourses = courses?.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.sku.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || course.status === statusFilter;

    const matchesDates = datesFilter === 'all' ||
      (datesFilter === 'with-dates' && (course.available_dates || 0) > 0) ||
      (datesFilter === 'without-dates' && (course.available_dates || 0) === 0);

    return matchesSearch && matchesStatus && matchesDates;
  }).sort((a, b) => {
    // Helper to get sort score
    // 3: Active & Has Dates
    // 2: Active & No Dates
    // 1: Inactive
    const getScore = (c: typeof a) => {
      if (c.status === 'inactive') return 1;
      if ((c.available_dates || 0) > 0) return 3;
      return 2;
    };

    const scoreA = getScore(a);
    const scoreB = getScore(b);

    if (scoreA !== scoreB) return scoreB - scoreA;

    // If both have dates, sort by amount of dates descending
    if (scoreA === 3) {
      return (b.available_dates || 0) - (a.available_dates || 0);
    }
    
    return 0;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary">{t.dashboard.title}</h1>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common.search}
            className="pl-8 max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t.common.status}:</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                {t.dashboard.filterAll}
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
              >
                {t.common.active}
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('inactive')}
              >
                {t.common.inactive}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t.dashboard.filterAvailableDates}:</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={datesFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setDatesFilter('all')}
              >
                {t.dashboard.filterAll}
              </Button>
              <Button
                size="sm"
                variant={datesFilter === 'with-dates' ? 'default' : 'outline'}
                onClick={() => setDatesFilter('with-dates')}
              >
                {t.dashboard.filterWithDates}
              </Button>
              <Button
                size="sm"
                variant={datesFilter === 'without-dates' ? 'default' : 'outline'}
                onClick={() => setDatesFilter('without-dates')}
              >
                {t.dashboard.filterWithoutDates}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardHeader>
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardHeader>
                    <CardFooter>
                         <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
      ) : isNotConfigured ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-amber-800 dark:text-amber-200">
                  {t.dashboard.accountNotConfigured || 'Account Not Configured'}
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  {t.dashboard.accountNotConfiguredDesc || 'Your account has not been linked to any courses yet.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300">
            <p className="mb-4">
              {t.dashboard.contactManagerDesc || 'Please contact your manager to get your account set up with the appropriate customer numbers. Once configured, you will be able to view and manage your courses here.'}
            </p>
            <Link href="/dashboard/contact">
              <Button variant="outline" className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50">
                <Mail className="mr-2 h-4 w-4" />
                {t.common.contactSupport}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredCourses?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t.dashboard.noCourses}</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
                {t.dashboard.noCoursesDesc}
            </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses?.map((course) => {
            const hasNoDates = (course.available_dates || 0) === 0;
            const isInactive = course.status === 'inactive';

            return (
              <Card
                key={course.id}
                className={cn(
                  "overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg",
                  hasNoDates && !isInactive && "border-amber-400/50 border-2 shadow-amber-100",
                  isInactive && "opacity-60 grayscale-[0.8] hover:opacity-100 hover:grayscale-0"
                )}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="object-cover w-full h-full transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-12 w-12" />
                    </div>
                  )}
                  <Badge
                      className={cn(
                        "absolute top-2 right-2 transition-colors",
                        course.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'
                      )}
                  >
                      {course.status === 'active' ? t.common.active : t.common.inactive}
                  </Badge>
                  {hasNoDates && course.status === 'active' && (
                    <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600 animate-pulse">
                      {t.dashboard.noDates}
                    </Badge>
                  )}
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start">
                      <CardTitle className="text-xl line-clamp-1">{course.title}</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {stripHtml(course.description)}
                  </CardDescription>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground font-mono">
                            SKU: {course.sku}
                        </div>
                         <div className="text-xs text-muted-foreground">
                             📍 {course.location}
                        </div>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {course.available_dates || 0} {(course.available_dates || 0) === 1 ? t.dashboard.availableDate : t.dashboard.availableDates}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                   <div className="font-semibold text-lg">€{course.basePrice}</div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/dashboard/editor/${course.id}`}>
                      <Edit className="mr-2 h-4 w-4" /> {t.dashboard.editCourse}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
