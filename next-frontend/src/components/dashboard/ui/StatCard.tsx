import type { LucideIcon } from 'lucide-react';

export type StatTone = 'brand' | 'success' | 'warning' | 'accent' | 'neutral';

export interface StatCardProps {
  /** What the number actually counts — never invent a metric. */
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  loading?: boolean;
}

const tones: Record<StatTone, { iconWrap: string; icon: string }> = {
  brand: { iconWrap: 'bg-[var(--primary-soft)]', icon: 'text-[var(--primary)]' },
  success: {
    iconWrap: 'bg-emerald-50 dark:bg-emerald-900/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    iconWrap: 'bg-amber-50 dark:bg-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  accent: { iconWrap: 'bg-[var(--secondary-soft)]', icon: 'text-[var(--secondary)]' },
  neutral: { iconWrap: 'bg-[var(--primary-soft)]/60', icon: 'text-[var(--ink-soft)]' },
};

/**
 * One honest number. Labels state exactly what is counted (e.g. "Colleges",
 * "Active colleges") — never invented platform-wide metrics.
 */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand', loading = false }: StatCardProps) {
  const t = tones[tone];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{label}</span>
        {Icon && (
          <span aria-hidden="true" className={`grid h-9 w-9 place-items-center rounded-xl ${t.iconWrap}`}>
            <Icon className={`h-4.5 w-4.5 ${t.icon}`} />
          </span>
        )}
      </div>
      {loading ? (
        <div className="animate-dashboard-skeleton mt-3 h-8 w-16 rounded-lg bg-[var(--line)]" aria-hidden="true" />
      ) : (
        <div className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--ink)]">{value}</div>
      )}
      {hint && !loading && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{hint}</p>}
    </div>
  );
}
