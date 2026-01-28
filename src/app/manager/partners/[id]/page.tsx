'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, User, Mail, Building, Package, Calendar, Plus, Trash2, Star } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Partner {
  id: string;
  name: string;
  email: string;
  customerNumbers?: string[];
  coursesCount: number;
  activeCoursesCount?: number;
  availableDatesCount?: number;
  pendingRequestsCount: number;
}

interface CustomerNumber {
  id: number;
  userId: string;
  customerNumber: string;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
}

interface PartnerUser {
  id: string;
  email: string;
  name: string;
  customerNumbers: CustomerNumber[];
}

async function fetchPartner(id: string): Promise<Partner> {
  const partner = await api.getPartner(id);
  if (!partner) throw new Error('Partner not found');
  return partner as unknown as Partner;
}

async function fetchPartnerUsers(partnerId: string): Promise<PartnerUser[]> {
  return api.getPartnerUsers(partnerId);
}

export default function PartnerDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const partnerId = params.id as string;
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PartnerUser | null>(null);
  const [newCustomerNumber, setNewCustomerNumber] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: () => fetchPartner(partnerId),
    enabled: hasHydrated && !!partnerId,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['partner-users', partnerId],
    queryFn: () => fetchPartnerUsers(partnerId),
    enabled: hasHydrated && !!partnerId,
  });

  const addMutation = useMutation({
    mutationFn: ({ userId, customerNumber, label }: { userId: string; customerNumber: string; label?: string }) =>
      api.addCustomerNumber(userId, customerNumber, label),
    onSuccess: () => {
      toast.success(t.manager.customerNumberAdded || 'Customer number added');
      queryClient.invalidateQueries({ queryKey: ['partner-users', partnerId] });
      setShowAddDialog(false);
      setNewCustomerNumber('');
      setNewLabel('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, cnId }: { userId: string; cnId: number }) =>
      api.removeCustomerNumber(userId, cnId),
    onSuccess: () => {
      toast.success(t.manager.customerNumberRemoved || 'Customer number removed');
      queryClient.invalidateQueries({ queryKey: ['partner-users', partnerId] });
    },
    onError: () => {
      toast.error(t.manager.removeError || 'Failed to remove customer number');
    },
  });

  const handleAddCustomerNumber = () => {
    if (!selectedUser || !newCustomerNumber.trim()) return;
    addMutation.mutate({
      userId: selectedUser.id,
      customerNumber: newCustomerNumber.trim(),
      label: newLabel.trim() || undefined,
    });
  };

  if (partnerLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t.manager.partnerNotFound || 'Partner not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/manager/partners"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t.common.back}
      </Link>

      {/* Partner Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{partner.name}</h1>
          <p className="text-muted-foreground">{partner.email}</p>
        </div>
        {partner.customerNumbers && partner.customerNumbers.length > 0 && (
          <Badge variant="secondary">
            {partner.customerNumbers.length} {t.manager.customerNumbers || 'Customer Numbers'}
          </Badge>
        )}
      </div>

      {/* Partner Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.partnerInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{partner.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{partner.email}</span>
            </div>
            {partner.customerNumbers && partner.customerNumbers.length > 0 && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {partner.customerNumbers.map(cn => (
                    <Badge key={cn} variant="outline" className="font-mono text-xs">
                      {cn}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.manager.statistics || 'Statistics'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{partner.activeCoursesCount ?? partner.coursesCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.manager.activeCourses}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{partner.availableDatesCount || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.manager.availableDates}</p>
              </div>
              {partner.pendingRequestsCount > 0 && (
                <div className="text-center">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {partner.pendingRequestsCount}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{t.manager.pendingRequests}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users with access */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t.manager.usersWithAccess || 'Users with Access'}</CardTitle>
              <CardDescription>{t.manager.usersWithAccessDesc || 'Portal users who can manage this partner\'s courses'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {t.manager.noUsersWithAccess || 'No users have access to this partner yet'}
            </p>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setNewCustomerNumber('');
                        setShowAddDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t.manager.addCustomerNumber}
                    </Button>
                  </div>

                  {/* Customer Numbers */}
                  <div className="space-y-2">
                    <Label className="text-xs">{t.manager.customerNumbers}</Label>
                    {user.customerNumbers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t.manager.noCustomerNumbers}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.customerNumbers.map((cn) => (
                          <div
                            key={cn.id}
                            className="flex items-center gap-2 bg-muted rounded-md px-3 py-1"
                          >
                            {cn.isPrimary && <Star className="h-3 w-3 text-yellow-500" />}
                            <span className="text-sm font-mono">{cn.customerNumber}</span>
                            {cn.label && (
                              <span className="text-xs text-muted-foreground">({cn.label})</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeMutation.mutate({ userId: user.id, cnId: cn.id })}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Number Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.manager.addCustomerNumber}</DialogTitle>
            <DialogDescription>
              {t.manager.addCustomerNumberDesc || 'Add a customer number to give this user access to a Magento partner account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.manager.customerNumberLabel}</Label>
              <Input
                value={newCustomerNumber}
                onChange={(e) => setNewCustomerNumber(e.target.value)}
                placeholder="e.g. 12345"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.manager.labelOptional}</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Main Account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleAddCustomerNumber}
              disabled={!newCustomerNumber.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? t.common.loading : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
