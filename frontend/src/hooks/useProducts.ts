import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { catalogService } from '../services/catalog';
import { ReviewSubmitPayload } from '../types';

export function useProducts(params?: {
  category?: string;
  in_stock?: boolean;
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
    onError: (error: any) => {
      const data = error?.response?.data;
      let message = 'Failed to submit review. Try again.';
      if (data) {
        if (typeof data.detail === 'string') message = data.detail;
        else if (data.comment && Array.isArray(data.comment)) message = data.comment[0];
        else if (typeof data.error === 'string') message = data.error;
      }
      toast.error(message);
    },
  });
}
