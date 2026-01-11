'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

type PageState = 'loading' | 'invalid' | 'valid' | 'success';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t, locale, setLocale } = useI18n();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [email, setEmail] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setPageState('invalid');
        return;
      }

      try {
        const result = await api.verifyResetToken(token);
        if (result.valid) {
          setEmail(result.email || '');
          setPageState('valid');
        } else {
          setPageState('invalid');
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        setPageState('invalid');
      }
    };

    verifyToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) return;

    try {
      await api.setNewPassword(token, data.newPassword);
      setPageState('success');
      toast.success(t.resetPassword.success);
    } catch (error) {
      console.error(error);
      toast.error(t.resetPassword.error);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t.resetPassword.verifying}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (pageState === 'invalid') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40 relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant={locale === 'de' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('de')}
          >
            DE
          </Button>
          <Button
            variant={locale === 'en' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('en')}
          >
            EN
          </Button>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl text-destructive">{t.resetPassword.invalidToken}</CardTitle>
            <CardDescription>
              {t.resetPassword.invalidTokenDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button onClick={() => router.push('/login')} className="w-full">
              {t.resetPassword.backToLogin}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40 relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant={locale === 'de' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('de')}
          >
            DE
          </Button>
          <Button
            variant={locale === 'en' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocale('en')}
          >
            EN
          </Button>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-xl text-green-600">{t.common.success}</CardTitle>
            <CardDescription>
              {t.resetPassword.success}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              {t.resetPassword.backToLogin}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid token - show password form
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant={locale === 'de' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLocale('de')}
        >
          DE
        </Button>
        <Button
          variant={locale === 'en' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLocale('en')}
        >
          EN
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">{t.resetPassword.title}</CardTitle>
          <CardDescription>
            {email && <span className="font-medium">{email}</span>}
            <br />
            {t.resetPassword.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t.resetPassword.newPassword}</Label>
              <Input
                id="newPassword"
                type="password"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message === 'Password must be at least 6 characters'
                    ? t.resetPassword.passwordMinLength
                    : errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.resetPassword.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message === "Passwords don't match"
                    ? t.resetPassword.passwordMismatch
                    : errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t.resetPassword.submitting : t.resetPassword.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
