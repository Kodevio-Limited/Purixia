import { create } from 'zustand';
import { User, RegisterPayload } from '../types';
import { authService, saveTokens, clearTokens, getAccessToken } from '../services/auth';
import { setAccessToken } from '../lib/token';
import { useCartStore } from './cartStore';

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  loading: true,

  setUser: (user) => set({ user, isLoggedIn: !!user }),
  
  clearUser: () => set({ user: null, isLoggedIn: false }),

  initAuth: async () => {
    set({ loading: true });
    try {
      if (!getAccessToken()) {
        // A reload wipes the in-memory token. Restore the session silently:
        // the HttpOnly refresh cookie goes along automatically and a fresh
        // access token comes back. Throws for anonymous visitors (no cookie),
        // which simply means "not logged in" — never a redirect.
        const { access } = await authService.refreshSession();
        setAccessToken(access);
      }
      const user = await authService.me();
      set({ user, isLoggedIn: true });
      await useCartStore.getState().fetchCart();
    } catch {
      // No session (or a dead one): stay logged out without redirecting.
      clearTokens();
      set({ user: null, isLoggedIn: false });
    }
    set({ loading: false });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const response = await authService.login({ email, password });
      saveTokens(response.tokens);
      set({ user: response.user, loading: false });
      
      // Sync cart after login (before setting isLoggedIn to prevent race condition)
      await useCartStore.getState().fetchCart();
      set({ isLoggedIn: true });
      
      return response.user;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const response = await authService.register(data);
      saveTokens(response.tokens);
      set({ user: response.user, loading: false });
      
      // Sync cart after registration (before setting isLoggedIn to prevent race condition)
      await useCartStore.getState().fetchCart();
      set({ isLoggedIn: true });
      
      return response.user;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      // Cookie + access header ride along; the backend blacklists the refresh
      // token and expires the cookie.
      await authService.logout();
    } catch (error) {
      console.error('Failed to blacklist token on backend logout', error);
    }
    clearTokens();
    set({ user: null, isLoggedIn: false, loading: false });
    
    // Sync cart after logout (should clear it or show anonymous cart)
    await useCartStore.getState().fetchCart();
  },
}));
