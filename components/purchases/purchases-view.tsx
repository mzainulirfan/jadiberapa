"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { getPurchases, getPurchasesReport, type BxPurchase, type BxPurchasesReport } from "@/lib/db/queries"
import { PurchaseForm } from "@/components/purchases/purchase-form"
import { Plus, ChevronRight, Wallet, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type FilterKey = "all" | "utang"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "utang", label: "Belum Lunas" },
]

export function PurchasesView({ initialSupplierId }: { initialSupplierId?: string | null }) {
  const [purchases, setPurchases] = useState<BxPurchase[] | null>(null)
  const [report, setReport] = useState<BxPurchasesReport | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [addOpen, setAddOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function refresh() {
    const [list, summary] = await Promise.all([getPurchases(), getPurchasesReport()])
    setPurchases(list)
    setReport(summary)
  }

  useEffect(() => {
    let active = true
    Promise.all([getPurchases(), getPurchasesReport()]).then(([list, summary]) => {
      if (!active) return
      setPurchases(list)
      setReport(summary)
    })
    return () => {
      active = false
    }
  }, [])

  const visible = filter === "utang" ? (purchases ?? []).filter((p) => p.status === "utang") : (purchases ?? [])

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-hairline bg-canvas p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.key ? "bg-primary text-primary-foreground" : "text-ink-muted active:bg-canvas-soft"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setFormKey((k) => k + 1)
            setAddOpen(true)
          }}
          className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-3.5" /> Beli
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Wallet className="size-4" />
            </span>
            <p className="text-xs font-medium text-ink-muted">Utang ke Supplier</p>
          </div>
          {report === null ? (
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-3 text-xl font-bold tracking-tight text-destructive">
              {fmtRp(report.outstandingDebt)}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-teal/10 text-accent-teal">
              <Package className="size-4" />
            </span>
            <p className="text-xs font-medium text-ink-muted">Nilai Pembelian</p>
          </div>
          {report === null ? (
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-3 text-xl font-bold tracking-tight text-ink">
              {fmtRp(report.totalPurchases)}
            </p>
          )}
        </div>
      </div>

      {purchases === null ? (
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-32 rounded-full" />
              </div>
              <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-muted">
            {filter === "utang" ? "Tidak ada utang ke supplier" : "Belum ada pembelian"}
          </p>
          {filter === "all" && (
            <p className="mt-1 text-xs text-ink-faint">Catat nota beli agar stok & utang tercatat rapi.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          {visible.map((p) => {
            const remaining = Math.max(0, p.total - p.paid_amount)
            return (
              <Link
                key={p.id}
                href={`/purchases/${p.id}`}
                className="flex items-center gap-3 p-3.5 transition-colors active:bg-canvas-soft"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-ink">{p.number}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {p.supplier_name ?? "Supplier dihapus"} · {fmtDate(p.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      p.status === "utang" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {p.status === "utang" ? "Belum Lunas" : "Lunas"}
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      remaining > 0 ? "text-destructive" : "text-ink"
                    )}
                  >
                    {fmtRp(p.status === "utang" ? remaining : p.total)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
              </Link>
            )
          })}
        </div>
      )}

      <PurchaseForm
        key={formKey}
        open={addOpen}
        onOpenChange={setAddOpen}
        initialSupplierId={initialSupplierId}
        onSaved={() => {
          refresh().catch(() => toast.error("Gagal memuat data"))
        }}
      />
    </div>
  )
}
