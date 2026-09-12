import React from 'react';
import { cn } from '../../lib/cn';

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-[--border-subtle] bg-[--surface] px-3 text-sm text-[--text-primary]',
        'placeholder:text-[--text-disabled]',
        'focus-visible:outline-none focus-visible:border-[--border-accent] focus-visible:ring-2 focus-visible:ring-[--focus-ring]/25',
        'disabled:bg-[--surface-sunken] disabled:text-[--text-disabled]',
        className
      )}
      {...props}
    />
  );
}
