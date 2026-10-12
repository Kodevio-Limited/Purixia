'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Trash2 } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useCartStore } from '../../stores/cartStore';
import { getImageUrl } from '../../lib/utils';
import Image from 'next/image';

export function CartDrawer() {
  const { isDrawerOpen, toggleDrawer } = useCart();
  const { items, grandTotal, removeItem } = useCartStore();

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleDrawer}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[440px] bg-surface shadow-2xl z-[201] flex flex-col font-poppins"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between bg-white border-b border-neutral-100">
              <h2 className="text-[20px] font-bold text-black">Your Cart</h2>
              <button
                onClick={toggleDrawer}
                className="p-2 text-neutral-500 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <ShoppingBag className="w-8 h-8 text-neutral-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">Your cart is empty</h3>
                    <p className="text-[13px] text-neutral-700 mt-1 max-w-[200px]">
                      Looks like you haven&apos;t added anything to your cart yet.
                    </p>
                  </div>
                  <button 
                    onClick={toggleDrawer}
                    className="mt-4 px-6 py-2.5 border border-orange text-orange font-bold text-[14px] rounded-[8px] hover:bg-orange hover:text-white transition-all uppercase tracking-wider"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product.id} className="bg-white rounded-[15px] p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] border border-neutral-100 flex gap-4 relative group">
                    <div className="relative w-[80px] h-[80px] bg-surface rounded-[10px] overflow-hidden shrink-0">
                      <Image
                        src={getImageUrl(item.product.image)}
                        alt={item.product.name}
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="text-[15px] font-bold text-black line-clamp-1">{item.product.name}</h3>
                      </div>
                      <p className="text-[14px] font-bold text-orange mb-1">৳ {item.price}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-neutral-700">Qty: {item.quantity}</p>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1.5 text-error hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            {items.length > 0 && (
              <div className="p-6 bg-white space-y-6 border-t border-neutral-100">
                <div className="bg-surface rounded-[15px] p-5 space-y-3 border border-neutral-100">
                  <div className="flex justify-between items-center text-[14px] text-neutral-700">
                    <span>Subtotal</span>
                    <span className="text-black font-semibold">৳ {grandTotal}</span>
                  </div>
                  <div className="flex justify-between items-center text-[16px] font-bold text-black pt-1 border-t border-neutral-100">
                    <span>Total</span>
                    <span>৳ {grandTotal}</span>
                  </div>
                </div>
                
                <Link href="/checkout" onClick={toggleDrawer}>
                  <button className="w-full h-[50px] bg-orange text-white font-bold text-[16px] rounded-[8px] hover:bg-orange-700 transition-colors shadow-sm uppercase tracking-wide">
                    Checkout Now
                  </button>
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
