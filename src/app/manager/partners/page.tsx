'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Partner } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PartnersPage() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: partners, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.getPartners(),
  });

  const filteredPartners = partners?.filter((partner: Partner) =>
    partner.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Sort by: 1. available dates (desc), 2. active courses (desc)
  const sortedPartners = [...filteredPartners].sort((a, b) => {
    const datesA = a.availableDatesCount ?? 0;
    const datesB = b.availableDatesCount ?? 0;
    if (datesB !== datesA) return datesB - datesA;

    const coursesA = a.activeCoursesCount ?? 0;
    const coursesB = b.activeCoursesCount ?? 0;
    return coursesB - coursesA;
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
          <h1 className="text-2xl font-bold">{t.manager.allPartners}</h1>
          <p className="text-muted-foreground">{t.manager.partnersDescription}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t.common.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {sortedPartners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">{t.manager.noPartners}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedPartners.map((partner: Partner) => (
            <Card key={partner.id}>
              <CardHeader>
                <CardTitle>{partner.companyName}</CardTitle>
                <CardDescription>{partner.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{partner.email}</p>

                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{partner.availableDatesCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t.manager.availableDates}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{partner.activeCoursesCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t.manager.activeCourses}</p>
                  </div>
                  {partner.pendingRequestsCount > 0 && (
                    <div className="text-center">
                      <Badge variant="secondary">{partner.pendingRequestsCount}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{t.manager.pendingRequests}</p>
                    </div>
                  )}
                </div>

                <Link href={`/manager/partners/${partner.id}`}>
                  <Button variant="outline" className="w-full">
                    {t.manager.viewPartner}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
