'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CategoryList } from '../../components/catalog/CategoryList';
import { SubcategoryList } from '../../components/catalog/SubcategoryList';
import { ProductGrid } from '../../components/catalog/ProductGrid';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { X } from 'lucide-react';

import { Suspense } from 'react';

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get('category');
  const activeSubcategory = searchParams.get('subcategory');
  const offered = searchParams.get('offered') === 'true';

  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const currentCategory = React.useMemo(() => {
    if (!categories || !activeCategory) return null;
    return categories.find((c) => c.slug === activeCategory) || null;
  }, [categories, activeCategory]);

  const {
    data: products,
    isLoading: isProductsLoading,
    isError,
  } = useProducts({
    category: activeCategory || undefined,
    subcategory: activeSubcategory || undefined,
    offered: offered || undefined,
  });

  const handleSelectCategory = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    // Reset subcategory when switching category
    params.delete('subcategory');
    router.push(`/products?${params.toString()}`);
  };

  const handleSelectSubcategory = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('subcategory', slug);
    } else {
      params.delete('subcategory');
    }
    router.push(`/products?${params.toString()}`);
  };

  const handleClearFilters = () => {
    router.push('/products');
  };

  const activeSubcategoryObj = React.useMemo(() => {
    if (!currentCategory?.subcategories || !activeSubcategory) return null;
    return currentCategory.subcategories.find((s) => s.slug === activeSubcategory);
  }, [currentCategory, activeSubcategory]);

  return (
    <PageWrapper className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-100 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight font-poppins">
            {activeSubcategoryObj
              ? `${activeSubcategoryObj.name} (${currentCategory?.name})`
              : currentCategory
              ? currentCategory.name
              : 'Our Catalog'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-poppins">
            Explore all original premium gadgets with official warranty
          </p>
        </div>

        {/* Active Filter Badges */}
        {(activeCategory || activeSubcategory || offered) && (
          <div className="flex items-center gap-2 flex-wrap">
            {currentCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-orange/10 text-orange font-medium">
                {currentCategory.name}
              </span>
            )}
            {activeSubcategoryObj && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-navy text-white font-medium">
                {activeSubcategoryObj.name}
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-error transition-colors ml-1 font-medium"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Category filters */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest font-poppins">
          Filter by Category
        </h2>
        <CategoryList
          categories={categories}
          isLoading={isCategoriesLoading}
          activeSlug={activeCategory}
          onSelect={handleSelectCategory}
        />
      </section>

      {/* Subcategory filters (rendered when a category with subcategories is selected) */}
      {currentCategory && currentCategory.subcategories && currentCategory.subcategories.length > 0 && (
        <section className="bg-surface/60 rounded-xl p-3 border border-neutral-200/60">
          <SubcategoryList
            subcategories={currentCategory.subcategories}
            activeSlug={activeSubcategory}
            onSelect={handleSelectSubcategory}
            categoryName={currentCategory.name}
          />
        </section>
      )}

      {/* Product list */}
      <section className="space-y-4 pt-2">
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange mx-auto mt-20" />
        </PageWrapper>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

