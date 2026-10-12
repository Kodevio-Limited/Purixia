'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { CartDrawer } from '../components/cart/CartDrawer';
import { initSentry } from '../lib/sentry';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create client on client side to avoid sharing cache across users
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const fetchCart = useCartStore((s) => s.fetchCart);
  const initializeAuth = useAuthStore((s) => s.initAuth);

  // Initialize cart and auth on mount
  React.useEffect(() => {
    initSentry();   // no-op unless NEXT_PUBLIC_SENTRY_DSN is set
    initializeAuth();
    fetchCart().catch(() => {});
  }, [fetchCart, initializeAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CartDrawer />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm font-semibold rounded-2xl bg-white border border-neutral-100 shadow-xl shadow-neutral-300/50',
          duration: 3000,
        }}
      />
    </QueryClientProvider>
  );
}
