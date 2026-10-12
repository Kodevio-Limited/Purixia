import * as React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'card' | 'image' | 'circle';
}

export function Skeleton({ className, variant = 'text', ...props }: SkeletonProps) {
  const variants = {
    text: 'h-4 w-full rounded-md',
    card: 'h-[320px] w-full rounded-2xl',
    image: 'h-full w-full rounded-xl',
    circle: 'h-10 w-10 rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-neutral-300/80',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
