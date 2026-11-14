import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Skip this field in the stacked mobile card (e.g. redundant labels). */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** While loading the table renders skeleton rows and announces the label. */
  loading?: boolean;
  loadingLabel?: string;
  /** Rendered instead of rows when the list is empty (an EmptyState). */
  empty?: ReactNode;
  skeletonRows?: number;
}

/**
 * The one table for the dashboards: a real table from `md` up, stacked cards
 * with labelled fields below it. Each card's first visible column renders as
 * the card title, the rest as header:value lines.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingLabel,
  empty,
  skeletonRows = 4,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div role="status" aria-label={loadingLabel} className="space-y-3">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <div className="animate-dashboard-skeleton h-4 w-1/3 rounded-md bg-[var(--line)]" />
            <div className="mt-3 space-y-2">
              <div className="animate-dashboard-skeleton h-3 w-2/3 rounded-md bg-[var(--line)]" />
              <div className="animate-dashboard-skeleton h-3 w-1/2 rounded-md bg-[var(--line)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  const visibleColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <>
      {/* Desktop: real table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--line)] md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--primary-soft)]/40">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="transition-colors hover:bg-[var(--primary-soft)]/25 motion-reduce:transition-none">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3.5 align-middle text-[var(--ink)]">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div key={getRowKey(row)} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
            {visibleColumns.map((column, columnIndex) => (
              <div
                key={column.key}
                className={columnIndex === 0 ? '' : 'flex items-start justify-between gap-4 border-t border-[var(--line)] pt-2.5 mt-2.5'}
              >
                {columnIndex > 0 && (
                  <span className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                    {column.header}
                  </span>
                )}
                <div className={columnIndex === 0 ? 'min-w-0' : 'min-w-0 text-right'}>
                  {column.render(row)}
                </div>
              </div>
            ))}
            <span className="sr-only">Row {index + 1}</span>
          </div>
        ))}
      </div>
    </>
  );
}
