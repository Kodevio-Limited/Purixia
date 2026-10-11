import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderService } from '../services/orders';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../lib/utils';
import type { DeliveryOptions, PlaceOrderPayload } from '../types';
import toast from 'react-hot-toast';

// Must mirror the backend defaults; used only until the server value arrives.
export const FALLBACK_DELIVERY_OPTIONS: DeliveryOptions = { inside: '60', outside: '120' };

export function useOrders() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getMyOrders,
    enabled: isLoggedIn,
  });
}

export function useDeliveryOptions() {
  return useQuery({
    queryKey: ['deliveryOptions'],
    queryFn: orderService.getDeliveryOptions,
    staleTime: 60 * 60 * 1000, // fees change rarely
  });
}

export function useOrder(id: number | string) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getOrder(id),
    enabled: isLoggedIn && !!id,
  });
}

export interface PlaceOrderVariables {
  payload: PlaceOrderPayload;
  // Identifies this checkout attempt so a retry cannot create a second order.
  idempotencyKey?: string;
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: PlaceOrderVariables) =>
      orderService.placeOrder(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
