import { create } from 'zustand';
import { CartItem, CartResponse } from '../types';

const STORAGE_KEY = 'purixia_cart';

function loadCart(): { items: CartItem[]; grandTotal: string; count: number } {
  if (typeof window === 'undefined') return { items: [], grandTotal: '0.00', count: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { items: [], grandTotal: '0.00', count: 0 };
}

function saveCart(state: { items: CartItem[]; grandTotal: string; count: number }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, grandTotal: state.grandTotal, count: state.count }));
  } catch { /* ignore */ }
}

function computeTotals(items: CartItem[]): { grandTotal: string; count: number } {
  const total = items.reduce((acc, item) => acc + parseFloat(item.price) * item.quantity, 0);
  const count = items.reduce((acc, item) => acc + item.quantity, 0);
  return { grandTotal: total.toFixed(2), count };
}

function enrichItem(item: CartItem): CartItem {
  return { ...item, total_price: (parseFloat(item.price) * item.quantity).toFixed(2) };
}

function salePriceOf(product: any): string {
  // Prefer the admin-discounted price when the backend provides one.
  const discounted = product?.discounted_price;
  const base = product?.price;
  const pick = discounted ?? base;
  return String(pick ?? '0');
}

function toCartItem(product: any, quantity: number): CartItem {
  const unitPrice = salePriceOf(product);
  return enrichItem({
    product: { id: product.id, name: product.name, price: unitPrice, image: product.image || null },
    quantity,
    price: unitPrice,
    total_price: '0',
  });
}

interface CartState {
  items: CartItem[];
  count: number;
  grandTotal: string;
  loading: boolean;
  isDrawerOpen: boolean;

  setCart: (cart: CartResponse) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: number | string, quantity?: number, product?: any) => Promise<void>;
  addItemSilent: (productId: number | string, quantity?: number, product?: any) => Promise<void>;
  updateItem: (productId: number | string, quantity: number) => Promise<void>;
  removeItem: (productId: number | string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => {
  const initial = loadCart();
  return {
    items: initial.items,
    count: initial.count,
    grandTotal: initial.grandTotal,
    loading: false,
    isDrawerOpen: false,

    setCart: (cart) => {
      const state = {
        items: cart.items || [],
        grandTotal: cart.grand_total || '0.00',
        count: cart.count || 0,
      };
      saveCart(state);
      return set(state);
    },

    openDrawer: () => set({ isDrawerOpen: true }),
    closeDrawer: () => set({ isDrawerOpen: false }),
    toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),

    fetchCart: async () => {
      const stored = loadCart();
      const current = get();
      // Only overwrite if localStorage has data, or the in-memory store is already empty
      if (stored.items.length > 0 || current.items.length === 0) {
        set({ items: stored.items, grandTotal: stored.grandTotal, count: stored.count });
      }
    },

    addItem: async (productId, quantity = 1, product?: any) => {
      set({ loading: true });
      try {
        const { items } = get();
        const id = Number(productId);
        const existing = items.find((i) => i.product.id === id);
        let newItems: CartItem[];
        if (existing) {
          newItems = items.map((i) =>
            i.product.id === id ? enrichItem({ ...i, quantity: i.quantity + quantity }) : i
          );
        } else {
          const src = product || await (await import('../services/catalog')).catalogService.getProduct(id);
          newItems = [...items, toCartItem(src, quantity)];
        }
        const totals = computeTotals(newItems);
        const state = { items: newItems, ...totals, loading: false };
        saveCart(state);
        set(state);
        get().openDrawer();
      } catch (error) {
        console.error('Failed to add item to cart', error);
        set({ loading: false });
        throw error;
      }
    },

    addItemSilent: async (productId, quantity = 1, product?: any) => {
      set({ loading: true });
      try {
        const { items } = get();
        const id = Number(productId);
        const existing = items.find((i) => i.product.id === id);
        let newItems: CartItem[];
        if (existing) {
          newItems = items.map((i) =>
            i.product.id === id ? enrichItem({ ...i, quantity: i.quantity + quantity }) : i
          );
        } else {
          const src = product || await (await import('../services/catalog')).catalogService.getProduct(id);
          newItems = [...items, toCartItem(src, quantity)];
        }
        const totals = computeTotals(newItems);
        const state = { items: newItems, ...totals, loading: false };
        saveCart(state);
        set(state);
      } catch (error) {
        console.error('Failed to add item to cart', error);
        set({ loading: false });
        throw error;
      }
    },

    updateItem: async (productId, quantity) => {
      const { items } = get();
      const id = Number(productId);
      const newItems = quantity <= 0
        ? items.filter((i) => i.product.id !== id)
        : items.map((i) => (i.product.id === id ? enrichItem({ ...i, quantity }) : i));
      const totals = computeTotals(newItems);
      const state = { items: newItems, ...totals };
      saveCart(state);
      set(state);
    },

    removeItem: async (productId) => {
      const { items } = get();
      const newItems = items.filter((i) => i.product.id !== Number(productId));
      const totals = computeTotals(newItems);
      const state = { items: newItems, ...totals };
      saveCart(state);
      set(state);
    },

    clearCart: async () => {
      const state = { items: [], grandTotal: '0.00', count: 0 };
      saveCart(state);
      set(state);
    },
  };
});
