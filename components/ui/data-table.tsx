"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  label: ReactNode
  align?: "left" | "right" | "center"
  className?: string
  render: (row: T) => ReactNode
}

// Tabel desktop yang hanya tampil pada layar >= lg. Kartu mobile tetap dipakai
// sebagai list utama; komponen ini hanya me-render baris dari data yang sama
// (tanpa query/effect tambahan) sehingga tidak ada duplikasi state.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  className,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "hidden overflow-x-auto rounded-xl border border-hairline bg-canvas lg:block",
        className
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs font-semibold text-ink-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-4 py-2.5 whitespace-nowrap",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.className
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-hairline last:border-0",
                onRowClick && "cursor-pointer hover:bg-canvas-soft"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-2.5",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.className
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
