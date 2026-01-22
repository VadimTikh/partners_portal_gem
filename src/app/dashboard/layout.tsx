'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, PlusCircle, LifeBuoy, Settings, LogOut, Languages, ShoppingCart, Receipt, Construction, CalendarCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    } else if (isManager) {
      // Redirect managers to their dashboard
      router.replace('/manager');
    }
  }, [isAuthenticated, isManager, hasHydrated, router]);

  if (!hasHydrated || !isAuthenticated || isManager) return null;

  const navigation = [
    { name: t.common.myCourses, href: '/dashboard', icon: LayoutDashboard },
    // { name: t.bookings.title, href: '/dashboard/bookings', icon: CalendarCheck }, // Hidden for now
    { name: t.common.addNewCourse, href: '/dashboard/requests', icon: PlusCircle },
    { name: t.common.orders, href: '/dashboard/orders', icon: ShoppingCart, inDevelopment: true },
    { name: t.common.accounting, href: '/dashboard/accounting', icon: Receipt, inDevelopment: true },
    { name: t.common.contactSupport, href: '/dashboard/contact', icon: LifeBuoy },
    { name: t.common.settings, href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/20 md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="https://www.miomente.de/skin/frontend/ultimo/default/images/goldenwebage/logo.png"
              alt="Miomente"
              width={140}
              height={40}
              className="h-10 w-auto"
              priority
            />
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
                  pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/dashboard')
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {item.inDevelopment && (
                  <Construction className="ml-auto h-3.5 w-3.5 text-orange-500" />
                )}
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
               {user?.name?.[0] || 'P'}
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
