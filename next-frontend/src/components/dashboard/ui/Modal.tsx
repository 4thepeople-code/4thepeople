'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { actions } from '@/lib/copy';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * The one dialog for the dashboards. Closes on Esc and overlay click, locks
 * body scroll, moves focus into the dialog and restores it on close. Forms
 * render their own buttons inside `children` (verb-specific labels from
 * lib/copy.ts — never a bare "OK").
 */
export default function Modal({ open, onClose, title, description, size = 'md', children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label={actions.close}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-dashboard-toast-in relative w-full ${sizes[size]} max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl outline-hidden`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-[var(--ink)]">{title}</h2>
            {description && <p className="mt-1 text-sm text-[var(--ink-soft)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={actions.close}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)]/60 hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
