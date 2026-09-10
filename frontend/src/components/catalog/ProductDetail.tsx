'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart, Star, BadgeCheck } from 'lucide-react';
import { Product } from '../../types';
import { cn, formatDate, formatPrice, getImageUrl } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface ProductDetailProps {
  product: Product;
}

type DetailTab = 'specification' | 'description' | 'reviews';

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'w-3.5 h-3.5',
            s <= Math.round(value) ? 'fill-[#F4B227] text-[#F4B227]' : 'fill-gray-200 text-gray-200'
          )}
        />
      ))}
    </span>
  );
}

export function ProductDetail({ product }: ProductDetailProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const addItem = useCartStore((s) => s.addItem);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const [quantity, setQuantity] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState(product.image);
  const [activeTab, setActiveTab] = React.useState<DetailTab>('specification');

  const allImages = React.useMemo(() => {
    const gallery = product.images?.map(img => img.image) || [];
    if (product.image && !gallery.includes(product.image)) {
      return [product.image, ...gallery];
    }
    return gallery.length > 0 ? gallery : [product.image];
  }, [product.image, product.images]);

  const discount = Number(product.discount_percent) || 0;
  const hasOffer = discount > 0;
  const salePrice = hasOffer ? product.discounted_price : product.price;
  const reviews = product.reviews || [];
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviewCount
    : Number(product.rating) || 0;

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addItem(product.id, quantity, product);
      toast.success('Added to cart!');
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!isLoggedIn) {
      try {
        await addItem(product.id, quantity, product);
        closeDrawer();
      } catch (e) {
        console.error('Add to cart before redirect failed', e);
      }
      toast('Please sign up first');
      router.push(`/register?redirect=/checkout&add_to_cart=${product.id}`);
      return;
    }
    setAdding(true);
    try {
      await addItem(product.id, quantity, product);
      closeDrawer();
      router.push('/checkout');
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'specification', label: 'Specification' },
    { id: 'description', label: 'Description' },
    { id: 'reviews', label: `Reviews${reviewCount > 0 ? ` (${reviewCount})` : ''}` },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-[40px] lg:px-[80px] py-[20px] font-poppins">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-4">
        <Link href="/" className="hover:text-[#F4B227] transition-colors">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products" className="hover:text-[#F4B227] transition-colors">Products</Link>
        <span aria-hidden="true">/</span>
        <span className="text-black font-semibold line-clamp-1">{product.name}</span>
      </nav>

      {/* Product Card */}
      <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] p-[24px] mb-[24px] border border-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[30px]">
          {/* Left: Images (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="relative aspect-square w-full bg-[#F5F5F5] rounded-[15px] overflow-hidden border border-gray-50">
              <Image
                src={getImageUrl(selectedImage)}
                alt={product.name}
                fill
                className="object-contain p-6"
                priority
              />
            </div>
            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img)}
                  aria-label={`View product image ${i + 1}`}
                  className={cn(
                    "relative w-[60px] h-[60px] bg-[#F5F5F5] rounded-[8px] overflow-hidden border transition-all cursor-pointer shrink-0",
                    selectedImage === img ? "border-[#F4B227]" : "border-gray-100 opacity-60 hover:opacity-100"
                  )}
                >
                  <Image
                    src={getImageUrl(img)}
                    alt={`${product.name} view ${i + 1}`}
                    fill
                    className="object-contain p-1"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Info (7 columns) */}
          <div className="lg:col-span-7 flex flex-col py-1">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h1 className="text-[22px] font-bold text-black mb-1 leading-tight">{product.name}</h1>
              </div>
              <span className="bg-[#ECFDF5] text-[#10B981] text-[9px] font-bold px-2 py-0.5 rounded-[4px] border border-[#D1FAE5] uppercase tracking-wider">
                In Stock
              </span>
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <ul className="mb-4 space-y-1">
                {product.features.map((feature) => (
                  <li key={feature.id} className="flex items-start gap-2 text-[13px] text-black">
                    <span aria-hidden="true" className="mt-[7px] w-1 h-1 rounded-full bg-black shrink-0" />
                    {feature.text}
                  </li>
                ))}
              </ul>
            )}

            {/* Rating summary */}
            <div className="flex items-center gap-2 mb-3">
              <Stars value={avgRating} />
              <span className="text-[12px] text-[#666666]">
                {reviewCount > 0 ? `${reviewCount} rating${reviewCount > 1 ? 's' : ''}` : '0 ratings'}
              </span>
            </div>

            {/* Price & Offer */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-[24px] font-bold text-black">{formatPrice(salePrice)}</span>
              {hasOffer && (
                <>
                  <span className="text-[14px] text-gray-400 line-through">{formatPrice(product.price)}</span>
                  <span className="text-[12px] text-red-500 font-bold">{discount}% OFF</span>
                </>
              )}
            </div>

            {/* Meta Info */}
            <div className="mb-6">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-black uppercase tracking-wider">SKU</span>
                <p className="text-[12px] text-[#666666]">#PRX-{String(product.id).padStart(6, '0')}</p>
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-8">
              <div className="flex items-center border border-gray-200 rounded-[8px] h-[44px] bg-gray-50 w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                  className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 h-full flex items-center justify-center text-[14px] font-bold border-x border-gray-200">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Increase quantity"
                  className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-1 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="flex-1 h-[44px] bg-black text-white text-[13px] font-bold rounded-[8px] hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={adding}
                  className="flex-1 h-[44px] bg-[#F4B227] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#D89500] transition-all shadow-sm uppercase tracking-wider"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specification / Description / Reviews */}
      <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] border border-gray-50 overflow-hidden">
        <div role="tablist" aria-label="Product information" className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 min-w-[120px] px-4 py-3 text-[13px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-black border-b-2 border-[#F4B227]'
                  : 'text-[#666666] hover:text-black'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-[24px]">
          {activeTab === 'specification' && (
            <div role="tabpanel">
              {product.specifications && product.specifications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {product.specifications.map((spec, i) => (
                        <tr key={spec.id} className={cn(i % 2 === 0 ? 'bg-gray-50' : 'bg-white')}>
                          <th className="text-left font-bold text-black px-4 py-2.5 w-[200px] sm:w-[280px] align-top">
                            {spec.name}
                          </th>
                          <td className="text-[#333333] px-4 py-2.5">{spec.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-[#666666]">No specifications added for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === 'description' && (
            <div role="tabpanel">
              <div className="text-[13px] text-[#666666] leading-relaxed whitespace-pre-line">
                {product.description || 'No description available for this product.'}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div role="tabpanel">
              <div className="flex items-center gap-3 mb-5">
                <Stars value={avgRating} className="[&>svg]:w-4 [&>svg]:h-4" />
                <span className="text-[13px] font-bold text-black">{avgRating.toFixed(1)}</span>
                <span className="text-[12px] text-[#666666]">
                  Based on {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </span>
              </div>
              {reviewCount > 0 ? (
                <ul className="space-y-4">
                  {reviews.map((review) => (
                    <li key={review.id} className="border border-gray-100 rounded-[12px] p-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-black">
                          {review.reviewer_name}
                          {review.is_verified_purchase && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                              <BadgeCheck className="w-3 h-3" />
                              Verified Purchase
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-[#999999]">{formatDate(review.created_at)}</span>
                      </div>
                      <Stars value={Number(review.rating)} className="mb-1.5" />
                      {review.title && (
                        <p className="text-[13px] font-semibold text-black mb-1">{review.title}</p>
                      )}
                      {review.comment && (
                        <p className="text-[13px] text-[#666666] leading-relaxed">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[#666666]">No reviews yet for this product.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
