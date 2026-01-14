'use client';

import { useI18n } from '@/lib/i18n';
import { ShoppingCart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function OrdersPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary">{t.common.orders}</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t.common.orders}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t.common.comingSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}
