import { useQuery } from '@tanstack/react-query';
import { catalogService } from '../services/catalog';

export function useSubcategories(categorySlug?: string) {
  return useQuery({
    queryKey: ['subcategories', categorySlug],
    queryFn: () => catalogService.getSubcategories(categorySlug ? { category: categorySlug } : undefined),
    staleTime: 5 * 60 * 1000,
  });
}
