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
    
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';
    
    const variants = {
      primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 focus:ring-violet-500 border border-transparent',
      secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300 border border-transparent',
      outline: 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-200',
      ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-100 border border-transparent',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 focus:ring-red-500 border border-transparent',
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
