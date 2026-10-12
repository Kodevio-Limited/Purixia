import * as React from 'react';
import { cn } from '../../lib/utils';
import { OrderStatus } from '../../types';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: OrderStatus | 'in_stock' | 'out_of_stock';
  size?: 'sm' | 'md';
}

export function Badge({ className, status = 'pending', size = 'sm', children, ...props }: BadgeProps) {
  
  const statusColors = {
    pending: 'bg-orange-100 text-orange-700 border-orange-300',
    confirmed: 'bg-navy-100 text-navy-700 border-navy-300',
    shipped: 'bg-navy text-white border-navy',
    delivered: 'bg-success-50 text-success border-success-100',
    cancelled: 'bg-error-50 text-error border-error-100',
    in_stock: 'bg-success-50 text-success border-success-100',
    out_of_stock: 'bg-error-50 text-error border-error-100',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border',
    md: 'px-2.5 py-1 text-xs font-semibold rounded-lg uppercase tracking-wide border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        statusColors[status] || 'bg-surface text-navy border-neutral-300',
        sizes[size],
        className
      )}
      {...props}
    >
      {children || status.replace('_', ' ')}
    </span>
  );
}
