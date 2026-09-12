import React, { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[--surface-inverse] text-[--text-inverse] hover:opacity-90',
  accent:
    'bg-[--accent] text-white hover:bg-[--accent-hover] shadow-xs',
  secondary:
    'bg-[--surface] text-[--text-primary] border border-[--border-subtle] hover:bg-[--surface-hover] hover:border-[--border-strong]',
  ghost:
    'bg-transparent text-[--text-body] hover:bg-[--surface-hover]',
  danger:
    'bg-transparent text-[--trust-failing-text] hover:bg-[--trust-failing-wash]',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ variant = 'secondary', size = 'md', className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg font-medium',
      'transition-[background-color,border-color,opacity] duration-[--dur-instant]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--canvas]',
      'disabled:pointer-events-none disabled:opacity-40',
      VARIANT[variant],
      SIZE[size],
      className
    )}
    {...props}
  />
));

Button.displayName = 'Button';
