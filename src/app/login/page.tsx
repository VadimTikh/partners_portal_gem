'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@partner.de',
      password: 'password123',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    // Mock check
    if (data.email === 'admin@partner.de' && data.password === 'password123') {
      login(data.email);
      toast.success(t.login.successMessage);
      router.push('/dashboard');
    } else {
      toast.error(t.login.invalidCredentials);
    }
  };

  const handleForgotPassword = () => {
    setIsForgotPasswordOpen(false);
    toast.success(t.login.resetSent);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">{t.login.title}</CardTitle>
          <CardDescription>
            {t.login.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.common.email}</Label>
              <Input id="email" type="email" placeholder="m@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.common.password}</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t.login.loggingIn : t.common.login}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="link" className="px-0 text-sm">
                {t.common.forgotPassword}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.login.resetTitle}</DialogTitle>
                <DialogDescription>
                  {t.login.resetDescription}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="reset-email">{t.common.email}</Label>
                  <Input id="reset-email" placeholder="m@example.com" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleForgotPassword}>{t.common.sendResetLink}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  );
}
