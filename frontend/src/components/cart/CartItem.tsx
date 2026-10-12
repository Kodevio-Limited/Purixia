'use client';

import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem as CartItemType } from '../../types';
import { formatPrice, getImageUrl } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const updateItem = useCartStore((s) => s.updateItem);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-xl">
      {/* Image */}
      <div className="relative w-16 h-16 bg-white rounded-lg overflow-hidden shrink-0 border border-neutral-100">
        <Image
          src={getImageUrl(item.product.image)}
          alt={item.product.name}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-navy truncate">{item.product.name}</h4>
        <p className="text-xs text-neutral-500">{formatPrice(item.price)} each</p>

        {/* Quantity controls */}
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => updateItem(item.product.id, item.quantity - 1)}
            className="w-6 h-6 flex items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-surface transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-bold text-navy w-6 text-center">{item.quantity}</span>
          <button
            onClick={() => updateItem(item.product.id, item.quantity + 1)}
            className="w-6 h-6 flex items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-surface transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right: subtotal + remove */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-navy">{formatPrice(item.total_price)}</span>
        <button
          onClick={() => removeItem(item.product.id)}
          className="p-1 text-neutral-500 hover:text-error transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
