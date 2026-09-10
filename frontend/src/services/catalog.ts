import api from '../lib/axios';
import { Category, CategoryDetail, Product, PaginatedResponse, ProductReview, ReviewSubmitPayload } from '../types';

export const catalogService = {
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get('/api/catalog/categories/');
    // Handle both paginated and non-paginated responses gracefully
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  },

  getCategoryDetail: async (slug: string): Promise<CategoryDetail> => {
    const response = await api.get(`/api/catalog/categories/${slug}/`);
    return response.data;
  },

  getProducts: async (params?: {
    category?: string;
    in_stock?: boolean;
    page?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await api.get('/api/catalog/products/', { params });
    return response.data;
  },

  getProduct: async (id: number | string): Promise<Product> => {
    const response = await api.get(`/api/catalog/products/${id}/`);
    return response.data;
  },

  // Submits a review for a product from the user panel (order page).
  // Backend requires: logged-in user, one review per product per user.
  createReview: async (productId: number | string, payload: ReviewSubmitPayload): Promise<ProductReview> => {
    const response = await api.post(`/api/catalog/products/${productId}/reviews/`, payload);
    return response.data;
  },
};
