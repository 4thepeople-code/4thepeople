'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { actions } from '@/lib/copy';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: keyof typeof sizes;
  children: ReactNode;
  /**
   * No panel padding/scroll — children manage their own layout (multi-step
   * wizards with pinned footers). The panel becomes a flex column capped at
   * 90vh; give the child `flex min-h-0 flex-1 flex-col`.
   */
  flush?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-7xl',
} as const;

/**
 * The one dialog for the dashboards. Closes on Esc and overlay click, locks
 * body scroll, moves focus into the dialog, traps Tab inside and restores
 * focus to the trigger on close. Forms render their own buttons inside
 * `children` (verb-specific labels from lib/copy.ts — never a bare "OK").
 */
export default function Modal({ open, onClose, title, description, size = 'md', flush = false, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Latest `onClose` without re-running the open effect below. Parents pass a
  // fresh closure on every render (inline handleClose), and with `onClose` in
  // the deps the effect re-ran on each keystroke inside the dialog: cleanup
  // restored focus to the trigger behind the dialog, the body refocused the
  // panel, and the input lost the caret after one character.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        // Focus trap: Tab / Shift+Tab cycle inside the panel instead of
        // reaching the page behind the dialog.
        const panel = dialogRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !(active instanceof HTMLElement) || !panel.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !(active instanceof HTMLElement) || !panel.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus();
    };
  }, [open]);

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
        className={`overlay-scope animate-dashboard-toast-in relative flex w-full flex-col ${sizes[size]} ${
          flush ? 'max-h-[90vh] overflow-hidden' : 'max-h-[90vh] overflow-y-auto p-6'
        } rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-xl outline-hidden`}
      >
        <div className={`flex items-start justify-between gap-4 ${flush ? 'shrink-0 border-b border-[var(--line)] px-6 py-4' : 'mb-4'}`}>
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
