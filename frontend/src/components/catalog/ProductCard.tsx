'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShoppingCart, Star } from 'lucide-react';
import { Product } from '../../types';
import { cn, formatPrice, getImageUrl } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';
import { Badge } from '../ui/Badge';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = React.useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.in_stock) return;

    setAdding(true);
    try {
      await addItem(product.id, 1, product);
      toast.success('Added to cart!');
    } catch {
      toast.error('Failed to add to cart');
    } finally {
      setAdding(false);
    }
  };

  const rating = parseFloat(product.rating) || 0;

  // Show the discounted selling price when an offer is active, with the base price struck through
  const hasOffer = Number(product.discount_percent) > 0;
  const salePrice = hasOffer ? product.discounted_price : product.price;

  return (
    <Link href={`/products/${product.id}`}>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group relative bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-neutral-300/50 transition-shadow overflow-hidden h-full flex flex-col"
      >
        {/* Image */}
        <div className="relative w-full aspect-square bg-surface overflow-hidden">
          <Image
            src={getImageUrl(product.image)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Stock badge */}
          <div className="absolute top-3 right-3">
            <Badge status={product.in_stock ? 'in_stock' : 'out_of_stock'} size="sm">
              {product.in_stock ? 'In Stock' : 'Out of Stock'}
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4">
          <h3 className="text-sm font-bold text-navy line-clamp-1 mb-0.5">{product.name}</h3>
          <p className="text-xs text-neutral-500 line-clamp-1 mb-2">{product.title}</p>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  'w-3.5 h-3.5',
                  star <= Math.round(rating) ? 'fill-orange text-orange' : 'text-neutral-300'
                )}
              />
            ))}
            <span className="text-[10px] text-neutral-500 ml-0.5">({rating})</span>
          </div>

          {/* Price + Cart button */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-extrabold text-orange">{formatPrice(salePrice)}</span>
              {hasOffer && (
                <span className="text-xs text-neutral-500 line-through">{formatPrice(product.price)}</span>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAddToCart}
              disabled={!product.in_stock || adding}
              className={cn(
                'p-2 rounded-xl transition-colors',
                product.in_stock
                  ? 'bg-orange-100 text-orange hover:bg-orange-100'
                  : 'bg-surface text-neutral-500 cursor-not-allowed'
              )}
            >
              <ShoppingCart className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
