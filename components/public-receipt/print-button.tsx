"use client"

import { Printer } from "@/components/ui/icons"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white active:bg-ink/80"
    >
      <Printer className="size-4" />
      Cetak / Simpan PDF
    </button>
  )
}
