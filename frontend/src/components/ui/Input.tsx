import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, id, ...props }, ref) => {
    // useId must be called unconditionally (never behind `||`), otherwise the
    // hook order changes between renders when `id` is supplied.
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-gray-700 tracking-wide select-none"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-white border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-200 focus:ring-violet-500',
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-500 font-medium mt-0.5 tracking-tight">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
