'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ResultStatus = 'success' | 'already_processed' | 'error';
type ResultCode =
  | 'confirmed'
  | 'declined'
  | 'expired'
  | 'not_found'
  | 'invalid_token'
  | 'server_error'
  | 'failed';

interface ResultConfig {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  getMessage: (t: ReturnType<typeof useI18n>['t']) => string;
}

function getResultConfig(status: ResultStatus, code: ResultCode): ResultConfig {
  // Success case
  if (status === 'success' && code === 'confirmed') {
    return {
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      getMessage: (t) => t.bookings.resultSuccess,
    };
  }

  // Already processed
  if (status === 'already_processed') {
    return {
      icon: Info,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      getMessage: (t) => t.bookings.resultAlreadyProcessed,
    };
  }

  // Error cases
  switch (code) {
    case 'expired':
      return {
        icon: Clock,
        iconColor: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        getMessage: (t) => t.bookings.resultExpired,
      };
    case 'not_found':
      return {
        icon: AlertTriangle,
        iconColor: 'text-orange-600',
        bgColor: 'bg-orange-50',
        getMessage: (t) => t.bookings.resultNotFound,
      };
    case 'invalid_token':
      return {
        icon: XCircle,
        iconColor: 'text-red-600',
        bgColor: 'bg-red-50',
        getMessage: (t) => t.bookings.resultInvalidToken,
      };
    default:
      return {
        icon: AlertTriangle,
        iconColor: 'text-red-600',
        bgColor: 'bg-red-50',
        getMessage: (t) => t.bookings.resultError,
      };
  }
}

function BookingResultContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const status = (searchParams.get('status') as ResultStatus) || 'error';
  const code = (searchParams.get('code') as ResultCode) || 'server_error';

  const config = getResultConfig(status, code);
  const Icon = config.icon;
  const message = config.getMessage(t);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${config.bgColor} mb-4`}
          >
            <Icon className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <CardTitle className="text-xl">{t.bookings.resultTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{message}</p>

          <Link href="/dashboard/bookings">
            <Button className="w-full">{t.bookings.goToPortal}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookingResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <BookingResultContent />
    </Suspense>
  );
}
