import React from 'react';
import { Pill } from './Pill';

export function StubBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-disabled
      className="rounded-xl border border-dashed border-[--border-strong] bg-[--surface-sunken]/60 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-dashed border-[--trust-unavailable]" />
        <span className="text-sm font-medium text-[--text-secondary]">{title}</span>
        <Pill tone="neutral">Not yet available</Pill>
      </div>
      <p className="mt-1.5 pl-4 text-xs leading-[18px] text-[--text-secondary]">
        {children}
      </p>
    </div>
  );
}
