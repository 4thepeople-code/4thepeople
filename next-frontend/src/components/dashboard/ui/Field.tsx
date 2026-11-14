'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

const controlBase =
  'min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--secondary)] aria-[invalid=true]:ring-[var(--secondary)]/30';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** Form field wrapper: label, control, hint below, error last (what + how to fix). */
export default function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-[var(--secondary)]">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--ink-soft)]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--secondary)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlBase} ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlBase} min-h-24 py-2.5 ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={`${controlBase} appearance-none pr-9 ${className}`} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
      />
    </div>
  );
}
