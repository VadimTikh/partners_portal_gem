'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, LogOut, Languages, Settings, LayoutDashboard, Users, Activity } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isManager = useAuthStore((state) => state.isManager);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!isManager) {
      // Redirect partners to their dashboard
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isManager, hasHydrated, router]);

  if (!hasHydrated || !isAuthenticated || !isManager) return null;

  const navigation = [
    { name: t.manager.dashboard, href: '/manager', icon: LayoutDashboard },
    { name: t.manager.courseRequests, href: '/manager/requests', icon: FileText },
    { name: t.manager.partners, href: '/manager/partners', icon: Users },
    { name: t.manager.activityLogs || 'Activity Logs', href: '/manager/activity', icon: Activity },
    { name: t.common.settings, href: '/manager/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/20 md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/manager/requests" className="flex flex-col">
            <Image
              src="https://www.miomente.de/skin/frontend/ultimo/default/images/goldenwebage/logo.png"
              alt="Miomente"
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
            <span className="text-xs font-medium text-muted-foreground tracking-wider uppercase">Manager Portal</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href || (item.href !== '/manager' && pathname.startsWith(item.href))
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t p-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-full justify-start gap-2">
                  <Languages className="h-4 w-4" />
                  {locale === 'de' ? 'Deutsch' : 'English'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocale('de')}>
                  Deutsch
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale('en')}>
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
              {user?.name?.[0] || 'M'}
            </div>
            <div className="text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            {t.common.logout}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
