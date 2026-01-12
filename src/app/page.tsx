'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isManager = useAuthStore((state) => state.isManager);

  useEffect(() => {
    if (isAuthenticated) {
      if (isManager) {
        router.push('/manager');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, isManager, router]);

  return null;
}