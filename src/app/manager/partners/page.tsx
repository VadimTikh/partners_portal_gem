'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Plus, X, Copy, Check, Eye, EyeOff, Info } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Partner } from '@/lib/types';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

export default function PartnersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // Create partner dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [customerNumberInputs, setCustomerNumberInputs] = useState(['']);
  const [createError, setCreateError] = useState<string | null>(null);

  // Password display dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [createdPartnerEmail, setCreatedPartnerEmail] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: partners, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.getPartners(),
    enabled: hasHydrated,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; email: string; customerNumbers: string[] }) =>
      api.createPartner(data),
    onSuccess: (result) => {
      setCreateError(null);
      toast.success(t.manager.partnerCreated || 'Partner created successfully');
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setShowCreateDialog(false);
      resetCreateForm();
      // Show password dialog
      setCreatedPartnerEmail(result.partner.email);
      setGeneratedPassword(result.generatedPassword);
      setShowPasswordDialog(true);
    },
    onError: (error: Error) => {
      // Show error in dialog
      const message = error.message;
      if (message.toLowerCase().includes('email already exists')) {
        setCreateError(t.manager.emailAlreadyExists || 'This email address is already registered');
      } else {
        setCreateError(message || t.manager.partnerCreateError || 'Failed to create partner');
      }
    },
  });

  const resetCreateForm = () => {
    setNewPartnerName('');
    setNewPartnerEmail('');
    setCustomerNumberInputs(['']);
    setCreateError(null);
  };

  const handleAddCustomerNumberInput = () => {
    setCustomerNumberInputs([...customerNumberInputs, '']);
  };

  const handleRemoveCustomerNumberInput = (index: number) => {
    if (customerNumberInputs.length > 1) {
      setCustomerNumberInputs(customerNumberInputs.filter((_, i) => i !== index));
    }
  };

  const handleCustomerNumberChange = (index: number, value: string) => {
    const updated = [...customerNumberInputs];
    updated[index] = value;
    setCustomerNumberInputs(updated);
  };

  const handleCreatePartner = () => {
    const customerNumbers = customerNumberInputs.filter(cn => cn.trim() !== '');
    if (!newPartnerName.trim() || !newPartnerEmail.trim() || customerNumbers.length === 0) {
      return;
    }
    createMutation.mutate({
      name: newPartnerName.trim(),
      email: newPartnerEmail.trim(),
      customerNumbers,
    });
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    setGeneratedPassword('');
    setCreatedPartnerEmail('');
    setPasswordCopied(false);
    setShowPassword(false);
  };

  const filteredPartners = partners?.filter((partner: Partner) =>
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
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.manager.addPartner || 'Add Partner'}
        </Button>
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
                <CardTitle>{partner.name}</CardTitle>
                <CardDescription>{partner.email}</CardDescription>
              </CardHeader>
              <CardContent>

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

      {/* Create Partner Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.manager.addPartner || 'Add Partner'}</DialogTitle>
            <DialogDescription>
              {t.manager.addPartnerDesc || 'Create a new partner account. A password will be generated automatically.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.manager.partnerName || 'Name'} *</Label>
              <Input
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.common.email} *</Label>
              <Input
                type="email"
                value={newPartnerEmail}
                onChange={(e) => { setNewPartnerEmail(e.target.value); setCreateError(null); }}
                placeholder="partner@example.com"
                className={createError ? 'border-red-500' : ''}
              />
              {createError && (
                <p className="text-sm text-red-500">{createError}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>{t.manager.customerNumbers} *</Label>
                <Tooltip>
                  <TooltipTrigger type="button" className="inline-flex">
                    <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs z-[100]">
                    <p>{t.manager.customerNumberTooltip || 'This number is used to connect the partner account to the main Miomente portal and determine which courses they can access.'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {customerNumberInputs.map((cn, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={cn}
                    onChange={(e) => handleCustomerNumberChange(index, e.target.value)}
                    placeholder={`${t.manager.customerNumberLabel || 'Customer Number'} ${index + 1}`}
                  />
                  {customerNumberInputs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCustomerNumberInput(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomerNumberInput}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.manager.addCustomerNumber}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleCreatePartner}
              disabled={
                !newPartnerName.trim() ||
                !newPartnerEmail.trim() ||
                customerNumberInputs.filter(cn => cn.trim()).length === 0 ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? t.common.loading : (t.manager.createPartner || 'Create Partner')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Display Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-green-600">
              {t.manager.partnerCreated || 'Partner Created Successfully'}
            </DialogTitle>
            <DialogDescription>
              {t.manager.passwordGeneratedDesc || 'A password has been generated for this account. Please save it now - it will not be shown again.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.common.email}</Label>
              <Input value={createdPartnerEmail} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>{t.common.password}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={generatedPassword}
                    readOnly
                    className="bg-muted font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="outline" onClick={handleCopyPassword}>
                  {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
              {t.manager.passwordWarning || 'This password will only be shown once. Make sure to copy and save it before closing this dialog.'}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClosePasswordDialog}>
              {t.manager.passwordSaved || 'I have saved the password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
