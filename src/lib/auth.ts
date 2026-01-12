import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isManager: boolean;
  isPartner: boolean;
  role: UserRole | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isManager: false,
      isPartner: false,
      role: null,
      login: (user: User, token?: string) =>
        set({
          user,
          token: token || user.token,
          isAuthenticated: !!(token || user.token),
          isManager: user.role === 'manager',
          isPartner: user.role === 'partner',
          role: user.role,
        }),
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isManager: false,
        isPartner: false,
        role: null,
      }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
