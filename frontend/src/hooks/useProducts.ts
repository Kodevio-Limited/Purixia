import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { catalogService } from '../services/catalog';
import { getErrorMessage } from '../lib/utils';
import { ReviewSubmitPayload } from '../types';

export function useProducts(params?: {
  category?: string;
  in_stock?: boolean;
  offered?: boolean;
  page?: number;
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => catalogService.getProducts(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogService.getProduct(id),
    enabled: !!id,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number | string; payload: ReviewSubmitPayload }) =>
      catalogService.createReview(productId, payload),
    onSuccess: () => {
      // Refresh product data (reviews list + rating) and order data (reviewed ids)
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Review submitted. Thank you!');
    },
    onError: (error: unknown) => {
      // Surfaces backend messages like "You can review this product once your
      // order is delivered." or per-field validation errors.
      toast.error(getErrorMessage(error));
    },
  });
}
