'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { EmptyState } from '../../components/ui/EmptyState';
import { Package, Calendar, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  const router = useRouter();
  const { isLoggedIn, loading: isChecking } = useAuth();
  const { data: orders, isLoading, isError } = useOrders();

  // Redirect if not logged in
  React.useEffect(() => {
    if (!isChecking && !isLoggedIn) {
      toast.error('Please register to view orders.', { id: 'orders-auth-error' });
      router.push('/register?redirect=/orders');
    }
  }, [isLoggedIn, isChecking, router]);

  if (isChecking || !isLoggedIn) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-orange border-t-transparent rounded-full animate-spin" />
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[50vh] text-center font-poppins">
        <h2 className="text-xl font-bold text-error">Failed to load orders</h2>
        <p className="text-sm text-neutral-500 mt-1">Please try refreshing the page.</p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="space-y-8 font-poppins max-w-[1440px] mx-auto px-[60px] md:px-[100px] py-[40px]">
      <div>
        <h1 className="text-[32px] font-bold text-black tracking-tight">Your Orders</h1>
        <p className="text-sm text-neutral-700 mt-1">Manage and track your recent orders status</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 w-full bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !orders || !orders.results || orders.results.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-neutral-300" />}
          title="No orders yet"
          description="Place your first order to see it listed here."
          actionLabel="Go to Catalog"
          onAction={() => router.push('/products')}
        />
      ) : (
        <div className="space-y-4">
          {orders.results.map((order) => {
            const date = new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            return (
              <div
                key={order.id}
                className="bg-white border border-neutral-100 rounded-[20px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[18px] font-bold text-black">Order #ORD-{order.id}</span>
                    <div className="px-3 py-1 bg-orange/10 text-orange text-[10px] font-bold rounded-full uppercase tracking-wider">
                      {order.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-700">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{date}</span>
                  </div>
                  <p className="text-xs text-neutral-700">
                    Delivery: <span className="font-semibold text-black capitalize">{order.delivery_type}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-8 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-neutral-100">
                  <div className="text-left sm:text-right">
                    <p className="text-[12px] text-neutral-700">Total Amount</p>
                    <p className="text-[20px] font-bold text-black">
                      ৳ {order.total_amount}
                    </p>
                  </div>
                  <Link href={`/orders/${order.id}`}>
                    <button className="flex items-center justify-center w-10 h-10 bg-orange text-white rounded-full hover:bg-black transition-colors shadow-sm">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageWrapper>
  );
}
