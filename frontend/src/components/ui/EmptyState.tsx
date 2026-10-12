import * as React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center text-center p-8 md:p-16 border border-dashed border-neutral-300 bg-surface/30 rounded-3xl min-h-[300px]">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-100 text-orange mb-4 animate-bounce duration-1000">
        {icon || <PackageOpen className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold text-navy tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
