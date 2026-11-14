'use client';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name, e.g. "Deactivate Spring Fest" / "Activate Spring Fest". */
  label: string;
  disabled?: boolean;
}

/**
 * Accessible on/off toggle (role="switch") with a 44px touch target. Used for
 * reversible status changes — pair with an Undo toast, not a confirm dialog.
 */
export default function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--primary)]' : 'bg-[var(--line)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
