import api from '../lib/axios';
import { DeliveryOptions, Order, PlaceOrderPayload, PaginatedResponse } from '../types';

export const orderService = {
  // Authoritative delivery fees from the backend, so the storefront never
  // hard-codes amounts that the server would compute differently.
  getDeliveryOptions: async (): Promise<DeliveryOptions> => {
    const response = await api.get('/api/orders/delivery-options/');
    return response.data;
  },

  // `idempotencyKey` identifies one checkout attempt: the server returns the
  // order it already created for that key rather than placing a second one, so
  // a double click or a retry after a network timeout is safe.
  placeOrder: async (
    payload: PlaceOrderPayload,
    idempotencyKey?: string,
  ): Promise<Order> => {
    const response = await api.post('/api/orders/place/', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    return response.data;
  },

  getMyOrders: async (): Promise<PaginatedResponse<Order>> => {
    const response = await api.get('/api/orders/');
    return response.data;
  },

  getOrder: async (id: number | string): Promise<Order> => {
    const response = await api.get(`/api/orders/${id}/`);
    return response.data;
  },
};
