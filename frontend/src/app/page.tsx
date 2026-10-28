'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBanners } from '../hooks/useBanners';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { getImageUrl, formatPrice, cn } from '../lib/utils';
import { ShoppingCart, Star, ChevronRight } from 'lucide-react';
import { Subcategory } from '../types';

export default function HomePage() {
  const { data: banners } = useBanners();
  const { data: products } = useProducts();
  const { data: offeredProducts } = useProducts({ offered: true });
  const { data: categories } = useCategories();
  const [currentBanner, setCurrentBanner] = React.useState(0);
  const [selectedCategoryForSubs, setSelectedCategoryForSubs] = React.useState<string | null>(null);

  // Auto-slide banners
  React.useEffect(() => {
    if (banners && banners.length > 1) {
      const timer = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [banners]);

  const categoriesWithSubs = React.useMemo(() => {
    return categories?.filter((c) => c.subcategories && c.subcategories.length > 0) || [];
  }, [categories]);

  const displayedSubcategories = React.useMemo(() => {
    if (!categories) return [];
    if (selectedCategoryForSubs) {
      const cat = categories.find((c) => c.slug === selectedCategoryForSubs);
      return cat?.subcategories || [];
    }
    // Return subcategories across categories
    const all: Subcategory[] = [];
    categories.forEach((cat) => {
      if (cat.subcategories) {
        all.push(...cat.subcategories);
      }
    });
    return all.slice(0, 12);
  }, [categories, selectedCategoryForSubs]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Banner Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[10px]">
        <div className="max-w-[1440px] mx-auto relative h-[200px] sm:h-[280px] md:h-[360px] bg-grad-hero rounded-[20px] overflow-hidden shadow-sm">
          {banners && banners.length > 0 ? (
            <div className="relative w-full h-full">
              {banners.map((banner, index) => (
                <div
                  key={banner.id}
                  className={cn(
                    "absolute inset-0 w-full h-full transition-opacity duration-1000",
                    index === currentBanner ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  <Image
                    src={getImageUrl(banner.image)}
                    alt={banner.title}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-black/20 flex flex-col justify-center px-4 sm:px-6 md:px-[40px] lg:px-[80px]">
                    {banner.subtitle && (
                      <h2 className="text-orange-300 text-[14px] md:text-[16px] font-bold italic mb-1 uppercase tracking-widest drop-shadow-sm">
                        {banner.subtitle}
                      </h2>
                    )}
                    <h1 className="text-white text-[32px] md:text-[44px] font-extrabold leading-[1.1] uppercase whitespace-pre-line drop-shadow-md">
                      {banner.title}
                    </h1>
                  </div>
                </div>
              ))}
              
              {/* Banner Pagination Dots */}
              {banners.length > 1 && (
                <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-20" role="group" aria-label="Banner navigation">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentBanner(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === currentBanner ? 'true' : undefined}
                      className={cn(
                        "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all",
                      )}
                    >
                      <span className={cn(
                        "block rounded-full transition-all",
                        i === currentBanner ? "bg-orange w-4 h-2" : "bg-white/50 w-2 h-2"
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-center px-4 sm:px-6 md:px-[40px] lg:px-[80px]">
              <h2 className="text-orange text-[14px] md:text-[16px] font-bold italic mb-1 uppercase tracking-widest">New Arrivals.</h2>
              <h1 className="text-white text-[32px] md:text-[44px] font-extrabold leading-[1.1] uppercase">
                GADGET <br /> SALE
              </h1>
            </div>
          )}
        </div>
      </section>

      {/* Shop by Category Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[15px] bg-white">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-[20px] md:text-[22px] font-bold text-black leading-tight">
                Shop by <span className="text-orange">Category</span>
              </h2>
              <span className="block w-10 h-[3px] bg-orange rounded-full mt-1.5 mb-2" />
              <p className="text-[12px] text-neutral-700 leading-relaxed">
                Explore our most popular gadget categories and find your perfect pick.
              </p>
            </div>
            <Link
              href="/products"
              className="shrink-0 inline-flex items-center gap-1 h-[36px] px-4 mt-0.5 bg-white border border-neutral-200 rounded-[8px] text-[12px] font-bold text-black shadow-sm hover:border-orange hover:text-orange transition-colors"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Category Cards — 4 per row on mobile */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            {categories?.slice(0, 8).map((cat) => {
              const hasSubs = cat.subcategories && cat.subcategories.length > 0;
              return (
                <div key={cat.id} className="group relative">
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="flex h-full flex-col items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-2 py-3 text-center transition-all group-hover:border-orange group-hover:shadow-[0_4px_15px_rgba(0,0,0,0.07)]"
                  >
                    <div className="relative w-10 h-10 shrink-0">
                      {cat.image ? (
                        <Image
                          src={getImageUrl(cat.image)}
                          alt={cat.name}
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center rounded-full bg-surface text-neutral-600 font-bold text-base">
                          {cat.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] sm:text-[12px] font-semibold text-black leading-tight line-clamp-2 group-hover:text-orange transition-colors">
                      {cat.name}
                    </span>
                  </Link>

                  {/* Subcategory Flyout (desktop hover) */}
                  {hasSubs && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 z-50 hidden md:block invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
                      <div className="w-[200px] rounded-[10px] border border-neutral-100 bg-white p-2 shadow-xl">
                        <Link
                          href={`/products?category=${cat.slug}`}
                          className="block px-2 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-orange border-b border-neutral-100 hover:underline"
                        >
                          All {cat.name}
                        </Link>
                        {cat.subcategories!.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/products?category=${cat.slug}&subcategory=${sub.slug}`}
                            className="block px-2 py-1.5 rounded text-xs text-neutral-700 hover:bg-surface hover:text-orange transition-colors"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Subcategories Section */}
      {displayedSubcategories.length > 0 && (
        <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[24px] bg-[#FAFBFD] border-y border-neutral-100">
          <div className="max-w-[1440px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 border-b border-neutral-200/60 pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange text-white">
                    Explore
                  </span>
                  <h2 className="text-[18px] md:text-[20px] font-bold text-black uppercase tracking-wider font-poppins">
                    Popular Subcategories
                  </h2>
                </div>
                <p className="text-[12px] text-neutral-600 mt-0.5">
                  Find exactly what you need by browsing subcategories
                </p>
              </div>

              {/* Category Filter Pills */}
              {categoriesWithSubs.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide max-w-full">
                  <button
                    onClick={() => setSelectedCategoryForSubs(null)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                      selectedCategoryForSubs === null
                        ? "bg-navy text-white border-navy shadow-sm"
                        : "bg-white text-neutral-700 border-neutral-200 hover:border-orange hover:text-orange"
                    )}
                  >
                    All
                  </button>
                  {categoriesWithSubs.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryForSubs(cat.slug)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                        selectedCategoryForSubs === cat.slug
                          ? "bg-navy text-white border-navy shadow-sm"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-orange hover:text-orange"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subcategories Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {displayedSubcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/products?category=${sub.category_slug}&subcategory=${sub.slug}`}
                  className="group bg-white rounded-xl p-3 border border-neutral-200/70 shadow-sm hover:shadow-md hover:border-orange transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange block mb-1">
                      {sub.category_name}
                    </span>
                    <h3 className="text-[13px] font-bold text-navy group-hover:text-orange transition-colors line-clamp-1 font-poppins">
                      {sub.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100">
                    <span className="text-[11px] text-neutral-400 group-hover:text-navy transition-colors font-medium">
                      View items
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-orange group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Popular Products Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[20px] bg-white">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex justify-between items-end mb-[20px] border-b border-neutral-100 pb-2">
            <div>
              <h2 className="text-[20px] font-bold text-black uppercase tracking-wider">Popular Products</h2>
              <p className="text-[12px] text-neutral-700">Top rated gadgets for you</p>
            </div>
            <Link href="/products" className="text-orange text-[11px] flex items-center gap-1 hover:text-black font-bold uppercase tracking-widest transition-colors mb-1">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[20px]">
          {products?.results?.slice(0, 4).map((product) => (
            <Link 
              key={product.id} 
              href={`/products/${product.id}`}
              className="group bg-white rounded-[10px] shadow-[0px_4px_15px_rgba(0,0,0,0.03)] overflow-hidden border border-neutral-100 flex flex-col transition-all hover:shadow-[0px_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 h-full cursor-pointer"
            >
              <div className="relative aspect-square w-full bg-surface overflow-hidden">
                <Image
                  src={getImageUrl(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="p-3.5 flex flex-col flex-1 gap-1">
                <h3 className="text-[13px] font-semibold text-black line-clamp-1 group-hover:text-orange transition-colors">{product.name}</h3>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'w-3 h-3',
                        s <= Math.round(Number(product.rating) || 0)
                          ? 'fill-orange text-orange'
                          : 'fill-neutral-300 text-neutral-300'
                      )}
                    />
                  ))}
                  <span className="text-[10px] text-neutral-500 ml-0.5">
                    ({Number(product.rating || 0).toFixed(1)})
                  </span>
                </div>
                <div className="flex justify-between items-center mt-auto pt-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[15px] font-bold text-black">
                      {formatPrice(Number(product.discount_percent) > 0 ? product.discounted_price : product.price)}
                    </span>
                    {Number(product.discount_percent) > 0 && (
                      <span className="text-[11px] text-neutral-500 line-through">{formatPrice(product.price)}</span>
                    )}
                  </div>
                  <div className="w-7 h-7 bg-orange rounded-[5px] flex items-center justify-center text-white group-hover:bg-black transition-colors shadow-sm">
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* Offered Products Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[20px] bg-white">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex justify-between items-end mb-[20px] border-b border-neutral-100 pb-2">
            <div>
              <h2 className="text-[20px] font-bold text-black uppercase tracking-wider">Offered Products</h2>
              <p className="text-[12px] text-neutral-700">Exclusive deals and discounts for you</p>
            </div>
            <Link href="/products?offered=true" className="text-orange text-[11px] flex items-center gap-1 hover:text-black font-bold uppercase tracking-widest transition-colors mb-1">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {offeredProducts?.results && offeredProducts.results.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[20px]">
              {offeredProducts.results.slice(0, 4).map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-white rounded-[10px] shadow-[0px_4px_15px_rgba(0,0,0,0.03)] overflow-hidden border border-neutral-100 flex flex-col transition-all hover:shadow-[0px_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 h-full cursor-pointer"
                >
                  <div className="relative aspect-square w-full bg-surface overflow-hidden">
                    <Image
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      fill
                      className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
                    />
                    {Number(product.discount_percent) > 0 && (
                      <span className="absolute top-2 left-2 bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {product.discount_percent}% OFF
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 flex flex-col flex-1 gap-1">
                    <h3 className="text-[13px] font-semibold text-black line-clamp-1 group-hover:text-orange transition-colors">{product.name}</h3>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-3 h-3 fill-orange text-orange" />
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-auto pt-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[15px] font-bold text-black">
                          {formatPrice(Number(product.discount_percent) > 0 ? product.discounted_price : product.price)}
                        </span>
                        {Number(product.discount_percent) > 0 && (
                          <span className="text-[11px] text-neutral-500 line-through">{formatPrice(product.price)}</span>
                        )}
                      </div>
                      <div className="w-7 h-7 bg-orange rounded-[5px] flex items-center justify-center text-white group-hover:bg-black transition-colors shadow-sm">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-[13px] text-neutral-700 py-8">No offered products at the moment. Check back soon for exclusive deals!</p>
          )}
        </div>
      </section>

      {/* Footer is already handled in layout.tsx */}
    </div>
  );
}
