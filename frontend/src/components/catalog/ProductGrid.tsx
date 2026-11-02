'use client';

import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProductGridProps {
  products?: Product[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  skeletonCount?: number;
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  errorMessage,
  skeletonCount = 8,
}: ProductGridProps) {
  const router = useRouter();

  if (isError) {
    return <ErrorMessage message={errorMessage || 'Failed to load products.'} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden">
            <Skeleton variant="card" />
          </div>
        ))}
      </div>
    );
  }

  const visibleProducts = products?.filter((p) => p.is_active !== false) || [];

  if (visibleProducts.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="w-8 h-8" />}
        title="No products found"
        description="Try a different category or check back later for new arrivals."
        actionLabel="Browse All"
        onAction={() => router.push('/products')}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {visibleProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
