'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useBanners } from '../hooks/useBanners';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { getImageUrl, formatPrice, cn } from '../lib/utils';
import { ShoppingCart, Star, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function HomePage() {
  const { data: banners } = useBanners();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const [currentBanner, setCurrentBanner] = React.useState(0);

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
        <div className="max-w-[1440px] mx-auto relative h-[200px] sm:h-[280px] md:h-[360px] bg-[#D89500] rounded-[20px] overflow-hidden shadow-sm">
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
                      <h2 className="text-[#F4B227] text-[14px] md:text-[16px] font-bold italic mb-1 uppercase tracking-widest drop-shadow-sm">
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
                        i === currentBanner ? "bg-[#F4B227] w-4 h-2" : "bg-white/50 w-2 h-2"
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-center px-4 sm:px-6 md:px-[40px] lg:px-[80px]">
              <h2 className="text-[#F4B227] text-[14px] md:text-[16px] font-bold italic mb-1 uppercase tracking-widest">New Arrivals.</h2>
              <h1 className="text-white text-[32px] md:text-[44px] font-extrabold leading-[1.1] uppercase">
                GADGET <br /> SALE
              </h1>
            </div>
          )}
        </div>
      </section>

      {/* Popular Categories Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[15px] bg-white">
        <div className="max-w-[1440px] mx-auto flex flex-col items-center">
          <h2 className="text-[20px] font-bold text-black mb-1 uppercase tracking-wider">Popular Categories</h2>
          <p className="text-[12px] text-[#666666] mb-[20px]">Explore our wide range of categories</p>
          
          <div className="flex flex-wrap gap-[16px] justify-center w-full">
            {categories?.slice(0, 6).map((cat) => (
              <Link 
                key={cat.id} 
                href={`/products?category=${cat.slug}`}
                className="flex flex-col items-center group w-[85px]"
              >
                <div className="w-[60px] h-[60px] rounded-full bg-[#F5F5F5] mb-2 overflow-hidden relative border border-gray-100 group-hover:border-[#F4B227] transition-all shadow-sm group-hover:shadow-md">
                  {cat.image ? (
                    <Image
                      src={getImageUrl(cat.image)}
                      alt={cat.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#666666] font-bold text-base">
                      {cat.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-[12px] font-bold text-black text-center group-hover:text-[#F4B227] transition-colors line-clamp-1 uppercase tracking-tight">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products Section */}
      <section className="w-full px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[20px] bg-white">
        <div className="max-w-[1440px] mx-auto">
          <div className="flex justify-between items-end mb-[20px] border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-[20px] font-bold text-black uppercase tracking-wider">Popular Products</h2>
              <p className="text-[12px] text-[#666666]">Top rated gadgets for you</p>
            </div>
            <Link href="/products" className="text-[#F4B227] text-[11px] flex items-center gap-1 hover:text-black font-bold uppercase tracking-widest transition-colors mb-1">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[20px]">
          {products?.results?.slice(0, 4).map((product) => (
            <Link 
              key={product.id} 
              href={`/products/${product.id}`}
              className="group bg-white rounded-[10px] shadow-[0px_4px_15px_rgba(0,0,0,0.03)] overflow-hidden border border-gray-100 flex flex-col transition-all hover:shadow-[0px_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 h-full cursor-pointer"
            >
              <div className="relative aspect-square w-full bg-[#F5F5F5] overflow-hidden">
                <Image
                  src={getImageUrl(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="p-3.5 flex flex-col flex-1 gap-1">
                <h3 className="text-[13px] font-semibold text-black line-clamp-1 group-hover:text-[#F4B227] transition-colors">{product.name}</h3>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3 h-3 fill-[#F4B227] text-[#F4B227]" />
                  ))}
                </div>
                <div className="flex justify-between items-center mt-auto pt-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[15px] font-bold text-black">
                      {formatPrice(Number(product.discount_percent) > 0 ? product.discounted_price : product.price)}
                    </span>
                    {Number(product.discount_percent) > 0 && (
                      <span className="text-[11px] text-gray-400 line-through">{formatPrice(product.price)}</span>
                    )}
                  </div>
                  <div className="w-7 h-7 bg-[#F4B227] rounded-[5px] flex items-center justify-center text-white group-hover:bg-black transition-colors shadow-sm">
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* Footer is already handled in layout.tsx */}
    </div>
  );
}
