import React from 'react';
import { TRUST, type TrustLevel } from '../../lib/variants';
import { cn } from '../../lib/cn';

export function TrustDot({
  level,
  size = 8,
  className,
}: {
  level: TrustLevel;
  size?: number;
  className?: string;
}) {
  const v = TRUST[level] ?? TRUST.unavailable;
  return (
    <span
      role="img"
      aria-label={v.label}
      style={{ width: size, height: size }}
      className={cn(
        'inline-block shrink-0 rounded-full',
        v.shape === 'solid' && v.dot,
        v.shape === 'half' &&
          cn(
            v.dot,
            'relative overflow-hidden after:absolute after:inset-y-0 after:right-0 after:w-1/2 after:bg-[--surface]'
          ),
        v.shape === 'ring' &&
          cn(
            v.dot,
            'ring-2 ring-offset-1 ring-[--trust-failing] ring-offset-[--surface]'
          ),
        v.shape === 'hollow' && 'border-[1.5px] border-[--trust-unclear]',
        v.shape === 'dashed' &&
          'border-[1.5px] border-dashed border-[--trust-unavailable]',
        className
      )}
    />
  );
}
