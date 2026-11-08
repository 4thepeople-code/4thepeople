import React from 'react';

export interface Column<T> {
  key?: string;
  accessor?: string | ((row: T) => React.ReactNode);
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T | string;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyField = 'id',
}: DataTableProps<T>) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[#E7E5E4] dark:border-[#2D2C30] bg-white dark:bg-[#1C1B1F] shadow-[0_1px_3px_rgba(0,0,0,0.04)] font-sans">
      <table className="w-full text-left text-sm text-[#1C1B1F] dark:text-[#F5F3EF] border-collapse">
        <thead className="bg-[#FAF9F7] dark:bg-[#252429] text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] border-b border-[#E7E5E4] dark:border-[#2D2C30]">
          <tr>
            {columns.map((col, index) => {
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : '';
              return (
                <th
                  key={col.key || (typeof col.accessor === 'string' ? col.accessor : undefined) || index}
                  className={`px-6 py-3.5 font-medium ${alignClass} ${col.className || col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0EFEF] dark:divide-[#2D2C30]">
          {data.map((row, rowIndex) => {
            const rowRecord = row as Record<string, unknown>;
            const rowKey =
              (typeof keyField === 'string' && rowRecord[keyField] !== undefined
                ? String(rowRecord[keyField])
                : undefined) || rowIndex;

            return (
              <tr
                key={rowKey}
                className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#252429]/50 transition-colors"
              >
                {columns.map((col, colIndex) => {
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : '';
                  const cellValue = col.accessor
                    ? typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : ((row as Record<string, unknown>)[col.accessor as string] as React.ReactNode)
                    : null;

                  return (
                    <td
                      key={col.key || (typeof col.accessor === 'string' ? col.accessor : undefined) || colIndex}
                      className={`px-6 py-4 whitespace-nowrap text-[#1C1B1F] dark:text-[#F5F3EF] ${alignClass} ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row, rowIndex) : cellValue}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
