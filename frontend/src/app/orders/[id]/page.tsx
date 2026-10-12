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

  // Hooks must run on every render, before any early return below.
  const reviewedProductIds = React.useMemo(
    () => new Set(order?.reviewed_product_ids || []),
    [order?.reviewed_product_ids]
  );
  const [reviewModalProduct, setReviewModalProduct] = React.useState<{ id: number; name: string } | null>(null);

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange" />
      </PageWrapper>
    );
  }

  if (isNaN(id)) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-navy">Invalid Order ID</h2>
        <Button variant="primary" onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-error">Order not found</h2>
        <p className="text-sm text-neutral-500 mt-1">
          We could not find the requested order in your account history.
        </p>
        <Button variant="primary" onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </PageWrapper>
    );
  }

  // All money values come from the server so the receipt can never disagree
  // with what was actually charged.
  const subtotal = parseFloat(order?.subtotal ?? '0') || 0;
  const shippingCost = parseFloat(order?.delivery_charge ?? '0') || 0;
  const grandTotal = parseFloat(order?.total_amount ?? '0') || 0;

  // Reviews: only delivered orders can be reviewed, one review per product per user.
  const isDelivered = order?.status === 'delivered';

  return (
    <PageWrapper className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/orders')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-navy transition-colors"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-navy tracking-tight">
                  Order #{order.id}
                </h1>
                <p className="text-xs text-neutral-500 mt-1">
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
                <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-navy flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-orange" />
                    Items Summary
                  </h2>

                  <div className="divide-y divide-neutral-100">
                    {order.items?.map((item) => {
                      const alreadyReviewed = reviewedProductIds.has(item.product);
                      return (
                        <div key={item.id} className="py-4 flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <p className="font-bold text-navy text-sm truncate">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {formatPrice(item.unit_price)} x {item.quantity}
                            </p>
                            {isDelivered && (
                              alreadyReviewed ? (
                                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-success">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Reviewed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReviewModalProduct({ id: item.product, name: item.product_name })}
                                  className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-orange/10 text-orange text-[11px] font-bold hover:bg-orange hover:text-white transition-colors"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  Write a Review
                                </button>
                              )
                            )}
                          </div>
                          <span className="font-extrabold text-sm text-navy shrink-0">
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-navy flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange" />
                    Shipping Details
                  </h2>

                  <div className="text-sm space-y-2">
                    <p className="font-bold text-navy">{order.shipping_info?.name}</p>
                    <p className="text-neutral-700">Phone: {order.shipping_info?.phone}</p>
                    {order.shipping_info?.email && (
                      <p className="text-neutral-700">Email: {order.shipping_info.email}</p>
                    )}
                    <p className="text-neutral-700 leading-relaxed">
                      Address: {order.shipping_info?.address}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery and Totals Summary */}
              <div className="space-y-6">
                <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm space-y-5">
                  <h3 className="font-bold text-navy text-base">Payment & Delivery</h3>

                  {/* Delivery Pill info */}
                  <div className="flex items-center gap-3 p-3 bg-surface rounded-2xl">
                    <Truck className="w-4 h-4 text-orange shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-navy capitalize">
                        {order.delivery_type} Delivery
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {order.delivery_type === 'inside'
                          ? '1 - 2 business days'
                          : '3 - 5 business days'}
                      </p>
                    </div>
                  </div>

                  {/* Payment Pill info */}
                  <div className="flex items-center gap-3 p-3 bg-surface rounded-2xl">
                    <Landmark className="w-4 h-4 text-orange shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-navy capitalize">
                        Cash on Delivery
                      </p>
                      <p className="text-[10px] text-neutral-500">Pay when package arrives</p>
                    </div>
                  </div>

                  {/* Pricing table */}
                  <div className="border-t border-neutral-100 pt-5 space-y-3">
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Items Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Delivery Fee</span>
                      <span>{formatPrice(shippingCost)}</span>
                    </div>
                    <div className="border-t border-neutral-100 pt-4 flex justify-between items-center">
                      <span className="font-bold text-sm text-navy">Total Amount</span>
                      <span className="text-xl font-extrabold text-orange">
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
