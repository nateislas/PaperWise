import React from 'react';
import { cn } from '../../lib/cn';

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'strong' | 'weak' | 'failing';
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral:
      'bg-[--surface-sunken] text-[--text-secondary] border-[--border-subtle]',
    accent:
      'bg-[--accent-subtle] text-[--text-accent] border-[--border-accent]/20',
    strong:
      'bg-[--trust-strong-wash] text-[--trust-strong-text] border-transparent',
    weak:
      'bg-[--trust-weak-wash] text-[--trust-weak-text] border-transparent',
    failing:
      'bg-[--trust-failing-wash] text-[--trust-failing-text] border-transparent',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
