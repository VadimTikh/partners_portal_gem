import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (email: string) =>
        set({
          user: { email, name: 'Partner Admin' },
          token: 'fake-jwt-token',
          isAuthenticated: true,
        }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
