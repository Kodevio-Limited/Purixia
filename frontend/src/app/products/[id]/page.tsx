'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { ProductDetail } from '../../../components/catalog/ProductDetail';
import { useProduct } from '../../../hooks/useProducts';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id ? parseInt(params.id as string, 10) : NaN;

  const { data: product, isLoading, isError } = useProduct(id);

  if (isNaN(id)) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-navy">Invalid Product ID</h2>
        <Button variant="primary" onClick={() => router.push('/products')} className="mt-4">
          Back to Products
        </Button>
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-error">Product not found</h2>
        <p className="text-sm text-neutral-500 mt-1">
          The product might have been removed or is temporarily unavailable.
        </p>
        <Button variant="primary" onClick={() => router.push('/products')} className="mt-4">
          Back to Products
        </Button>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-navy transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <Skeleton variant="image" className="w-full aspect-square rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4 rounded" />
            <Skeleton className="h-10 w-3/4 rounded" />
            <Skeleton className="h-6 w-1/2 rounded" />
            <Skeleton className="h-12 w-1/3 rounded" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        product && <ProductDetail product={product} />
      )}
    </PageWrapper>
  );
}
