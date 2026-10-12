'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

// The drag/animation handlers are omitted so the same props can be forwarded to
// framer-motion's `motion.button` without a type cast.
export interface ButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragOver'
  > {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, icon, children, disabled, ...props }, ref) => {
    
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';
    
    const variants = {
      primary: 'bg-orange hover:bg-orange-700 active:bg-orange-700 text-white shadow-md shadow-orange-100 focus-visible:ring-orange border border-transparent',
      secondary: 'bg-navy hover:bg-navy-700 active:bg-navy-700 text-white shadow-md shadow-navy-100 focus-visible:ring-navy border border-transparent',
      outline: 'bg-transparent border border-orange text-orange hover:bg-orange hover:text-white focus-visible:ring-orange',
      ghost: 'bg-transparent text-navy hover:bg-surface focus-visible:ring-neutral-300 border border-transparent',
      danger: 'bg-error hover:opacity-90 active:opacity-90 text-white shadow-md shadow-error-100 focus-visible:ring-error border border-transparent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3.5 text-base gap-2 rounded-2xl',
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        whileTap={{ scale: 0.97 }}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Spinner size="sm" className="text-current" />}
        {!loading && icon && <span className="inline-flex shrink-0">{icon}</span>}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
