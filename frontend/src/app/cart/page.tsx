'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useCartStore } from '../../stores/cartStore';
import { formatPrice, getImageUrl } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Trash2, ArrowRight, ShoppingBag, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, grandTotal, updateItem, removeItem, clearCart } = useCartStore();
  const [clearing, setClearing] = React.useState(false);

  const handleClear = async () => {
    setClearing(true);
    await clearCart();
    toast.success('Cart cleared');
    setClearing(false);
  };

  return (
    <PageWrapper className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Shopping Cart</h1>
        <p className="text-sm text-gray-500 mt-1">Review the items you have added to your cart</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your cart is empty</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
              Looks like you haven&apos;t added any products to your shopping cart.
            </p>
          </div>
          <Link href="/products">
            <Button variant="primary">Start Shopping</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Cart Items ({items.length})
              </span>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Clear Shopping Cart'}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                      <Image
                        src={getImageUrl(item.product.image)}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div>
                      <Link
                        href={`/products/${item.product.id}`}
                        className="text-base font-bold text-gray-900 hover:text-violet-600 transition-colors"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-sm font-extrabold text-violet-700 mt-1">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                    {/* Quantity controls */}
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <button
                        onClick={() => updateItem(item.product.id, item.quantity - 1)}
                        className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3.5 py-1.5 text-sm font-bold text-gray-900 min-w-[36px] text-center border-x border-gray-200">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateItem(item.product.id, item.quantity + 1)}
                        className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-base font-extrabold text-gray-900 min-w-[80px] text-right">
                        {formatPrice(item.total_price)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart summary */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm h-fit space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Order Summary</h3>

            <div className="space-y-3.5 border-b border-gray-50 pb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-900">{formatPrice(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span className="text-green-600 font-semibold">Calculated at checkout</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Estimated Total</span>
              <span className="text-2xl font-extrabold text-violet-700">
                {formatPrice(grandTotal)}
              </span>
            </div>

            <Link href="/checkout" className="block w-full">
              <Button variant="primary" size="lg" fullWidth className="shadow-lg shadow-violet-200">
                Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
