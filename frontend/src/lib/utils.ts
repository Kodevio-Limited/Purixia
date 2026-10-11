import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiError } from '../types';
import axios from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A key identifying exactly one checkout attempt, sent as `Idempotency-Key`.
 *
 * The API stores it with the order, so a retried request (double click, timeout
 * then retry) returns the order that already exists instead of placing a second
 * one. Must satisfy the server's 8-64 char `[A-Za-z0-9._:-]` rule.
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function formatPrice(price: string | number): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice)) return '৳ 0.00';
  return `৳ ${numericPrice.toFixed(2)}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getImageUrl(path: string | null): string {
  if (!path) return '/images/placeholder.png';
  
  // Strip any accidental backticks or quotes that might come from the API/DB
  const cleanPath = path.trim().replace(/^[`'"]|[`'"]$/g, '');

  // If it's already a full URL, return it
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }

  // Get base URL from env
  // We remove the '/api' suffix if it exists because media is served from the root
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? 'http://localhost:8000' : 'http://127.0.0.1:8000');
  
  // Remove trailing slash and '/api' suffix for image base URL
  let cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (cleanBase.endsWith('/api')) {
    cleanBase = cleanBase.slice(0, -4);
  }
  
  const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${cleanBase}${finalPath}`;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    if (apiError) {
      if (apiError.detail) return apiError.detail;
      if (apiError.error) return apiError.error;
      if (apiError.non_field_errors && apiError.non_field_errors.length > 0) {
        return apiError.non_field_errors[0];
      }
      // Check for first field error
      const keys = Object.keys(apiError);
      for (const key of keys) {
        if (key !== 'detail' && key !== 'error' && key !== 'non_field_errors') {
          const val = apiError[key];
          if (Array.isArray(val) && val.length > 0) {
            return `${key}: ${val[0]}`;
          } else if (typeof val === 'string') {
            return `${key}: ${val}`;
          }
        }
      }
    }
    return error.message || 'An error occurred with the network request.';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Something went wrong. Try again.';
}
