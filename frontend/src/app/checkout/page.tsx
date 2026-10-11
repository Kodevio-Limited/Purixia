'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../stores/cartStore';
import { usePlaceOrder, useDeliveryOptions, FALLBACK_DELIVERY_OPTIONS } from '../../hooks/useOrders';
import { cn, createIdempotencyKey, getImageUrl } from '../../lib/utils';
import { X, Trash2, CheckCircle, Home } from 'lucide-react';
import toast from 'react-hot-toast';

// Cash on delivery depends on reaching the customer, so these rules mirror
// backend/apps/orders/serializers.py: the customer is told about a bad phone
// number or address here instead of after the order request is rejected.
const BD_PHONE_PATTERN = /^(?:\+?880|0)1[3-9]\d{8}$/;

/** Strip the separators customers type; the server stores one canonical form. */
const normalizePhone = (value: string) => value.replace(/[\s\-().]/g, '');

const checkoutSchema = z.object({
  name: z.string().min(2, 'Enter the name of the person receiving the order'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .refine((value) => BD_PHONE_PATTERN.test(normalizePhone(value)), {
      message: 'Enter a valid Bangladeshi mobile number, e.g. 01712345678',
    }),
  address: z
    .string()
    .min(10, 'Enter the full delivery address (house, road, area, district)')
    .max(500, 'Address is too long (500 characters maximum)'),
  delivery_type: z.enum(['inside', 'outside']),
  payment_method: z.enum(['cod', 'card', 'bkash', 'nagad']),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { isLoggedIn, user, loading: isChecking } = useAuth();
  const { items, removeItem } = useCartStore();
  const placeOrderMutation = usePlaceOrder();
  // Delivery fees are owned by the backend; fall back to the documented
  // defaults only until that request resolves.
  const { data: deliveryOptions } = useDeliveryOptions();
  const [orderSuccess, setOrderSuccess] = React.useState<{ id: string } | null>(null);
  // One key per checkout attempt, reused while the attempt is unresolved.
  const idempotencyKeyRef = React.useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      delivery_type: 'inside',
      payment_method: 'cod',
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  // Autofill from user data
  React.useEffect(() => {
    if (user) {
      setValue('name', user.username || '');
      setValue('email', user.email || '');
      setValue('phone', user.phone || '');
    }
  }, [user, setValue]);

  const deliveryType = watch('delivery_type');
  const paymentMethod = watch('payment_method');

  // Redirect if not logged in
  React.useEffect(() => {
    if (!isChecking && !isLoggedIn) {
      toast.error('Please register to place an order.', { id: 'checkout-auth-error' });
      const firstId = items.length > 0 ? items[0].product.id : '';
      router.push(`/register?redirect=/checkout${firstId ? `&add_to_cart=${firstId}` : ''}`);
    }
  }, [isLoggedIn, isChecking, router, items]);

  if (orderSuccess) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 md:px-[80px] lg:px-[120px] py-12 sm:py-[100px] flex items-center justify-center font-poppins">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[20px] shadow-[0px_10px_40px_rgba(0,0,0,0.05)] p-6 sm:p-10 lg:p-[60px] text-center max-w-[600px] w-full"
        >
          <div className="w-20 h-20 bg-[#10B981] rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-[32px] font-bold text-black mb-4">Order Confirmed!</h1>
          <p className="text-[16px] text-[#666666] mb-10">
            Your order <span className="font-bold text-black">#ORD-{orderSuccess.id}</span> has been placed successfully.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => router.push('/')}
              className="flex-1 h-[54px] bg-[#F4B227] text-white font-bold rounded-[8px] flex items-center justify-center gap-2 hover:bg-[#D89500] transition-colors shadow-sm"
            >
              <Home className="w-5 h-5" /> Go to Homepage
            </button>
            <button 
              onClick={() => router.push('/products')}
              className="flex-1 h-[54px] border border-[#F4B227] text-[#F4B227] font-bold rounded-[8px] hover:bg-[#F4B227] hover:text-white transition-all"
            >
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isChecking || !isLoggedIn) return null;

  const fees = deliveryOptions ?? FALLBACK_DELIVERY_OPTIONS;
  const shippingCost = parseFloat(deliveryType === 'outside' ? fees.outside : fees.inside) || 0;
  const subtotal = items.reduce((acc, item) => acc + parseFloat(item.price) * item.quantity, 0);
  const grandTotal = subtotal + shippingCost;

  const onSubmit = async (values: CheckoutFormValues) => {
    if (items.length === 0) {
      toast.error('Your cart is empty. Please add items before checkout.');
      return;
    }

    // Reuse the key until the attempt resolves, so a double click or a retry
    // after a timeout returns the same order instead of placing a second one.
    const idempotencyKey = idempotencyKeyRef.current ?? createIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;

    const payload = {
      shipping_info: {
        name: values.name,
        email: values.email,
        phone: normalizePhone(values.phone),
        address: values.address,
      },
      delivery_type: values.delivery_type,
      payment_method: values.payment_method,
      items: items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    try {
      const order = await placeOrderMutation.mutateAsync({ payload, idempotencyKey });
      // The order exists now; the next attempt must get a fresh key.
      idempotencyKeyRef.current = null;
      setOrderSuccess({ id: String(order.id) });
      useCartStore.getState().setCart({ items: [], grand_total: '0.00', count: 0 });
    } catch {
      // Keep the key so the retry is treated as the same attempt.
      // The error toast is surfaced by usePlaceOrder's onError handler.
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 md:px-[80px] lg:px-[120px] py-[40px] font-poppins">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-bold text-black">Order Details</h1>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-black">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form and Items */}
        <div className="lg:col-span-2 space-y-8">
          {/* Cart Items Summary */}
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.product.id} className="bg-white rounded-[15px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-50 flex gap-6 relative">
                <div className="relative w-[100px] h-[100px] bg-[#F5F5F5] rounded-[12px] overflow-hidden shrink-0">
                  <Image src={getImageUrl(item.product.image)} alt={item.product.name} fill className="object-contain p-2" />
                </div>
                <div className="flex flex-col flex-1 justify-center">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-[18px] font-semibold text-black">{item.product.name}</h3>
                    <p className="text-[16px] font-bold text-black">Price : <span className="font-medium text-[#666666]">৳ {item.price}</span></p>
                  </div>
                  <p className="text-[14px] text-[#666666] mb-2">SKU : #W12345</p>
                  <p className="text-[14px] text-[#666666]">Quantity : {item.quantity}</p>
                </div>
                <button onClick={() => removeItem(item.product.id)} className="absolute right-6 bottom-6 p-2 text-red-400 hover:text-red-600">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Shipping Info */}
          <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] p-8">
            <h2 className="text-[20px] font-bold text-black mb-6">Shipping Information</h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-black">Name</label>
                <input {...register('name')} placeholder="Enter your name" className="w-full h-[48px] px-4 bg-white border border-gray-100 rounded-[8px] text-sm focus:outline-none focus:border-[#F4B227]" />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-black">Email Address</label>
                <input {...register('email')} placeholder="Enter your email" className="w-full h-[48px] px-4 bg-white border border-gray-100 rounded-[8px] text-sm focus:outline-none focus:border-[#F4B227]" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-black">Phone Number</label>
                <input {...register('phone')} placeholder="Enter your phone number" className="w-full h-[48px] px-4 bg-white border border-gray-100 rounded-[8px] text-sm focus:outline-none focus:border-[#F4B227]" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-black">Address</label>
                <input {...register('address')} placeholder="Enter full address" className="w-full h-[48px] px-4 bg-white border border-gray-100 rounded-[8px] text-sm focus:outline-none focus:border-[#F4B227]" />
                {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
              </div>
            </div>
          </div>

          {/* Delivery Option */}
          <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] p-8">
            <h2 className="text-[20px] font-bold text-black mb-6">Delivery</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-black">Select Delivery</label>
                <select {...register('delivery_type')} className="w-full h-[48px] px-4 bg-white border border-gray-100 rounded-[8px] text-sm focus:outline-none focus:border-[#F4B227] appearance-none cursor-pointer">
                  <option value="inside">Inside Dhaka: {fees.inside} TK</option>
                  <option value="outside">Outside Dhaka: {fees.outside} TK</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] p-8">
            <h2 className="text-[20px] font-bold text-black mb-6">Payment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              {['cod', 'card', 'bkash', 'nagad'].map((method) => (
                <label key={method} className={cn(
                  "flex items-center gap-3 h-[48px] px-4 border rounded-[8px] cursor-pointer transition-all",
                  paymentMethod === method ? "border-[#F4B227] bg-[#F4B227]/5" : "border-gray-100"
                )}>
                  <input type="radio" value={method} {...register('payment_method')} className="accent-[#F4B227]" />
                  <span className="text-sm font-medium text-black capitalize">
                    {method === 'cod' ? 'Cash On Delivery' : method}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-1 h-fit sticky top-24">
          <div className="bg-white rounded-[20px] shadow-[0px_4px_30px_rgba(0,0,0,0.03)] p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[16px] text-[#666666]">
                <span>Subtotal</span>
                <div className="flex-1 mx-4 border-b border-dotted border-gray-300 translate-y-[-4px]" />
                <span className="text-black font-semibold">৳ {subtotal}</span>
              </div>
              <div className="flex justify-between items-center text-[16px] text-[#666666]">
                <span>Delivery</span>
                <div className="flex-1 mx-4 border-b border-dotted border-gray-300 translate-y-[-4px]" />
                <span className="text-black font-semibold">৳ {shippingCost}</span>
              </div>
              <div className="flex justify-between items-center text-[20px] font-bold text-black pt-2">
                <span>Total</span>
                <div className="flex-1 mx-4 border-b border-dotted border-gray-300 translate-y-[-4px]" />
                <span>৳ {grandTotal}</span>
              </div>
            </div>
            
            <button 
              onClick={handleSubmit(onSubmit)}
              disabled={placeOrderMutation.isPending}
              className="w-full h-[54px] bg-[#F4B227] text-white font-bold text-[18px] rounded-[8px] hover:bg-[#D89500] transition-colors shadow-sm uppercase tracking-wide disabled:opacity-50"
            >
              {placeOrderMutation.isPending ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

