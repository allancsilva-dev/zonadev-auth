import { ReactNode } from 'react';
import { SkeletonRow } from './SkeletonRow';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
}: DataTableProps<T>) {
  if (loading) {
    return <SkeletonRow rows={5} cols={columns.length} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {columns.map(col => (
              <th
                key={String(col.key)}
                className="text-left py-3 px-4 text-slate-400 font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={row.id}
                className="border-b border-slate-700/50 hover:bg-slate-800 transition-colors"
              >
                {columns.map(col => (
                  <td key={String(col.key)} className="py-3 px-4 text-slate-300">
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
