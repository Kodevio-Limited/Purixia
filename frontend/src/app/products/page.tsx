'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CategoryList } from '../../components/catalog/CategoryList';
import { ProductGrid } from '../../components/catalog/ProductGrid';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';

import { Suspense } from 'react';

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get('category');
  const offered = searchParams.get('offered') === 'true';

  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const {
    data: products,
    isLoading: isProductsLoading,
    isError,
  } = useProducts({
    category: activeCategory || undefined,
    offered: offered || undefined,
  });

  const handleSelectCategory = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    router.push(`/products?${params.toString()}`);
  };

  return (
    <PageWrapper className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Our Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">
          Explore all original premium gadgets with official warranty
        </p>
      </div>

      {/* Category filters */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Filter by Category
        </h2>
        <CategoryList
          categories={categories}
          isLoading={isCategoriesLoading}
          activeSlug={activeCategory}
          onSelect={handleSelectCategory}
        />
      </section>

      {/* Product list */}
      <section className="space-y-4">
        <ProductGrid
          products={products?.results}
          isLoading={isProductsLoading}
          isError={isError}
          skeletonCount={12}
        />
      </section>
    </PageWrapper>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper className="space-y-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mt-20" />
        </PageWrapper>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

