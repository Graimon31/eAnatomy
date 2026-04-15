import { create } from 'zustand';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('admin_token'),
  isAuthenticated: !!localStorage.getItem('admin_token'),
  login: (user, token, refreshToken) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_refresh_token', refreshToken);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
