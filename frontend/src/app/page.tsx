'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBanners } from '../hooks/useBanners';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { getImageUrl, formatPrice, cn } from '../lib/utils';
import { ShoppingCart, Star, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

export default function HomePage() {
  const { data: banners } = useBanners();
  const { data: products } = useProducts();
  const { data: offeredProducts } = useProducts({ offered: true });
  const { data: categories } = useCategories();
  const [currentBanner, setCurrentBanner] = React.useState(0);
  const [showAllMobileCategories, setShowAllMobileCategories] = React.useState(false);

  // Auto-slide banners
  React.useEffect(() => {
    if (banners && banners.length > 1) {
      const timer = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [banners]);

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

      {/* Popular Categories Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[20px] bg-white">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-2">
            <div>
              <h2 className="text-[18px] md:text-[20px] font-bold text-black uppercase tracking-wider font-poppins">
                Popular Categories
              </h2>
              <p className="text-[11px] md:text-[12px] text-neutral-500">
                Explore our wide range of categories
              </p>
            </div>
            {/* View all header button */}
            <button
              onClick={() => setShowAllMobileCategories(!showAllMobileCategories)}
              className="text-orange text-[12px] font-bold uppercase tracking-wider flex items-center gap-1 hover:text-navy transition-colors py-1 px-2 rounded cursor-pointer"
            >
              <span className="hidden sm:inline">
                {showAllMobileCategories ? 'Show Less' : 'View All'}
              </span>
              <span className="sm:hidden">
                {showAllMobileCategories ? 'Less' : 'View All'}
              </span>
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 transition-transform duration-200',
                  showAllMobileCategories && 'rotate-90'
                )}
              />
            </button>
          </div>

          {/* Categories Grid: 4 in a row for mobile view (Row 1: 4, Row 2: 4) */}
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-2 gap-y-4 sm:gap-x-4 sm:gap-y-6">
            {(showAllMobileCategories ? categories : categories?.slice(0, 8))?.map((cat) => (
              <Link 
                key={cat.id} 
                href={`/products?category=${cat.slug}`}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-[62px] h-[62px] sm:w-[76px] sm:h-[76px] rounded-full bg-surface mb-1.5 overflow-hidden relative border border-neutral-200/80 group-hover:border-orange group-active:scale-95 transition-all shadow-sm group-hover:shadow-md flex items-center justify-center">
                  {cat.image ? (
                    <Image
                      src={getImageUrl(cat.image)}
                      alt={cat.name}
                      fill
                      className="object-cover p-1.5 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-navy font-bold text-lg sm:text-xl bg-orange/5 group-hover:bg-orange/10 transition-colors">
                      {cat.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-[11px] sm:text-[12px] font-semibold text-neutral-800 text-center line-clamp-2 leading-[1.2] group-hover:text-orange transition-colors tracking-tight">
                  {cat.name}
                </span>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <span className="text-[9px] text-neutral-400 mt-0.5 hidden sm:inline">
                    {cat.subcategories.length} subcategories
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Mobile View All Trigger below the 2 rows */}
          {categories && categories.length > 8 && (
            <div className="mt-4 flex justify-center md:hidden">
              <button
                onClick={() => setShowAllMobileCategories(!showAllMobileCategories)}
                className="w-full py-2 px-4 rounded-xl border border-orange/40 bg-orange/5 text-orange font-bold text-xs flex items-center justify-center gap-1.5 active:bg-orange/10 transition-colors uppercase tracking-wider"
              >
                {showAllMobileCategories ? (
                  <>
                    Show Less <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    View All Categories ({categories.length}) <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

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
