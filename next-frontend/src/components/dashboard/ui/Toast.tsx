'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { toasts } from '@/lib/copy';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  /** Defaults to 4s; errors stay a little longer. */
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

const variantStyles: Record<ToastVariant, string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-200',
  error:
    'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-200',
  info: 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]',
};

/**
 * Inline/toast feedback — never a blocking modal for routine actions.
 * Mount <ToastProvider> once (it lives in shared/Providers) and call
 * `const { toast } = useToast()` anywhere inside it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const variant = options?.variant ?? 'info';
      const durationMs = options?.durationMs ?? (variant === 'error' ? 6500 : 4000);
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, message, variant, durationMs }]);
    },
    [],
  );

  // Announce via a polite live region; individual toasts time themselves out.
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
    >
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = icons[item.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(timer);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={`animate-dashboard-toast-in pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3.5 shadow-lg ${variantStyles[item.variant]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-xs font-medium leading-relaxed">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={toasts.dismiss}
        className="min-h-6 rounded-md p-1 transition-colors hover:bg-black/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Toasts are feedback, not critical: degrade to a no-op outside the provider.
    return { toast: () => {} };
  }
  return context;
}
