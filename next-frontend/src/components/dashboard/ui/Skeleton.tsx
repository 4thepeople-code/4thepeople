import type { HTMLAttributes } from 'react';

type Shape = 'line' | 'block' | 'circle';

const shapes: Record<Shape, string> = {
  line: 'h-4 rounded-md',
  block: 'h-28 rounded-2xl',
  circle: 'h-12 w-12 rounded-full',
};

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: Shape;
  /** For `line` skeletons: width fraction of the container, e.g. "2/3". */
  width?: string;
  label?: string;
}

/**
 * Loading placeholder — never a bare spinner. Announces itself politely when
 * `label` is given (e.g. "Loading clubs").
 */
export default function Skeleton({
  shape = 'line',
  width,
  label,
  className = '',
  ...rest
}: SkeletonProps) {
  return (
    <div
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`animate-dashboard-skeleton bg-[var(--line)] ${shapes[shape]} ${className}`}
      style={width ? { width } : undefined}
      {...rest}
    />
  );
}

/** Stack of text-line placeholders. */
export function SkeletonLines({ count = 3, className = '' }: { count?: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-2/3', 'w-5/6'];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} shape="line" className={widths[i % widths.length]} />
      ))}
    </div>
  );
}

/** Full card placeholder: header line + block + two text lines. */
export function SkeletonCard({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div
      role={label ? 'status' : undefined}
      aria-label={label}
      className={`rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 ${className}`}
    >
      <Skeleton shape="line" className="w-1/3" />
      <Skeleton shape="block" className="mt-4" />
      <SkeletonLines count={2} className="mt-4" />
    </div>
  );
}
