import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function ErrorMessage({ message, className, ...props }: ErrorMessageProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 bg-error-50 border border-error-100/60 rounded-xl text-sm text-error',
        className
      )}
      role="alert"
      {...props}
    >
      <AlertCircle className="w-5 h-5 shrink-0 text-error" />
      <span className="font-medium">{message}</span>
    </div>
  );
}
