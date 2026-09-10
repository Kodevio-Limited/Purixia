'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useOrder } from '../../../hooks/useOrders';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ReviewModal } from '../../../components/reviews/ReviewModal';
import { formatPrice } from '../../../lib/utils';
import { ArrowLeft, MapPin, Truck, Landmark, ShoppingBag, Star, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, loading: isChecking } = useAuth();
  const id = params.id ? parseInt(params.id as string, 10) : NaN;

  const { data: order, isLoading, isError } = useOrder(id);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!isChecking && !isLoggedIn) {
      toast.error('Please login.', { id: 'order-detail-auth-error' });
      router.push('/login?redirect=/orders');
    }
  }, [isLoggedIn, isChecking, router]);

  if (isChecking || !isLoggedIn) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </PageWrapper>
    );
  }

  if (isNaN(id)) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-gray-900">Invalid Order ID</h2>
        <Button variant="primary" onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-red-600">Order not found</h2>
        <p className="text-sm text-gray-500 mt-1">
          We could not find the requested order in your account history.
        </p>
        <Button variant="primary" onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </PageWrapper>
    );
  }

  const shippingCost = order?.delivery_type === 'outside' ? 120 : 60;
  const subtotal = order ? parseFloat(order.total_amount) : 0;
  const grandTotal = subtotal + shippingCost;

  // Reviews: only delivered orders can be reviewed, one review per product per user.
  const isDelivered = order?.status === 'delivered';
  const reviewedProductIds = React.useMemo(
    () => new Set(order?.reviewed_product_ids || []),
    [order?.reviewed_product_ids]
  );
  const [reviewModalProduct, setReviewModalProduct] = React.useState<{ id: number; name: string } | null>(null);

  return (
    <PageWrapper className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/orders')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-40 w-full rounded-3xl" />
            </div>
            <Skeleton className="h-60 w-full rounded-3xl" />
          </div>
        </div>
      ) : (
        order && (
          <div className="space-y-8">
            {/* Title card */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  Order #{order.id}
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  Placed on{' '}
                  {new Date(order.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={order.status} size="md">
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Order Items */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-violet-600" />
                    Items Summary
                  </h2>

                  <div className="divide-y divide-gray-50">
                    {order.items?.map((item) => {
                      const alreadyReviewed = reviewedProductIds.has(item.product);
                      return (
                        <div key={item.id} className="py-4 flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatPrice(item.unit_price)} x {item.quantity}
                            </p>
                            {isDelivered && (
                              alreadyReviewed ? (
                                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Reviewed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReviewModalProduct({ id: item.product, name: item.product_name })}
                                  className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-[#F4B227]/10 text-[#F4B227] text-[11px] font-bold hover:bg-[#F4B227] hover:text-white transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  Write a Review
                                </button>
                              )
                            )}
                          </div>
                          <span className="font-extrabold text-sm text-gray-900 shrink-0">
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-violet-600" />
                    Shipping Details
                  </h2>

                  <div className="text-sm space-y-2">
                    <p className="font-bold text-gray-900">{order.shipping_info?.name}</p>
                    <p className="text-gray-600">Phone: {order.shipping_info?.phone}</p>
                    {order.shipping_info?.email && (
                      <p className="text-gray-600">Email: {order.shipping_info.email}</p>
                    )}
                    <p className="text-gray-600 leading-relaxed">
                      Address: {order.shipping_info?.address}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery and Totals Summary */}
              <div className="space-y-6">
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
                  <h3 className="font-bold text-gray-900 text-base">Payment & Delivery</h3>

                  {/* Delivery Pill info */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                    <Truck className="w-4 h-4 text-violet-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 capitalize">
                        {order.delivery_type} Delivery
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {order.delivery_type === 'inside'
                          ? '1 - 2 business days'
                          : '3 - 5 business days'}
                      </p>
                    </div>
                  </div>

                  {/* Payment Pill info */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                    <Landmark className="w-4 h-4 text-violet-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-900 capitalize">
                        Cash on Delivery
                      </p>
                      <p className="text-[10px] text-gray-400">Pay when package arrives</p>
                    </div>
                  </div>

                  {/* Pricing table */}
                  <div className="border-t border-gray-100 pt-5 space-y-3">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Items Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Delivery Fee</span>
                      <span>{formatPrice(shippingCost)}</span>
                    </div>
                    <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                      <span className="font-bold text-sm text-gray-900">Total Amount</span>
                      <span className="text-xl font-extrabold text-violet-700">
                        {formatPrice(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Review modal for delivered order items */}
      {reviewModalProduct && (
        <ReviewModal
          open={!!reviewModalProduct}
          onClose={() => setReviewModalProduct(null)}
          productId={reviewModalProduct.id}
          productName={reviewModalProduct.name}
        />
      )}
    </PageWrapper>
  );
}
