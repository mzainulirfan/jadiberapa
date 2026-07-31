"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardData } from "@/lib/actions/dashboard"
import { Receipt, Package, Dollar, ChevronRight } from "@/components/ui/icons"

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

type RecentTx = { id: string; total: number; created_at: string }
type TopProduct = { product_id: string; qty: number; products?: { name?: string } | null }

const dateLabel = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date())

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const recent = data.recentTransactions as RecentTx[]
  const top = data.topProducts as TopProduct[]
  const maxQty = Math.max(...top.map((p) => p.qty), 1)

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
          Dashboard
        </h1>
        <p className="text-ink-muted text-sm">{dateLabel}</p>
      </div>

      <div className="rounded-2xl bg-ink text-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white/60">Penjualan Hari Ini</p>
          <Dollar className="size-5 text-white/60" />
        </div>
        <p className="text-[30px] font-bold tracking-tight text-white mt-1">
          Rp{data.todayTotal.toLocaleString()}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Receipt className="size-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-white/60">Transaksi</p>
              <p className="text-base font-semibold text-white leading-tight">{data.todayCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Package className="size-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-white/60">Barang Terjual</p>
              <p className="text-base font-semibold text-white leading-tight">{data.todayItems}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-canvas border border-hairline">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h2 className="text-sm font-semibold text-ink">Transaksi Terbaru</h2>
          <Link
            href="/transactions"
            className="flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            Lihat semua
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-ink-faint">Belum ada transaksi</p>
        ) : (
          <div>
            {recent.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-t border-hairline px-4 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
                    <Receipt className="size-4" />
                  </span>
                  <p className="text-xs text-ink-muted">
                    {timeFormat.format(new Date(tx.created_at))}
                  </p>
                </div>
                <p className="text-sm font-semibold text-ink">Rp{tx.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-canvas border border-hairline p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Produk Terlaris</h2>
          <Link
            href="/products"
            className="flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            Lihat semua
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-ink-faint">Belum ada data</p>
        ) : (
          <div className="space-y-3">
            {top.map((p, i) => (
              <div key={`${p.product_id}-${i}`}>
                <div className="flex items-center justify-between text-sm">
                  <p className="flex items-center gap-2 min-w-0">
                    <span className="w-4 shrink-0 text-xs font-semibold text-ink-faint">{i + 1}</span>
                    <span className="truncate text-ink">{p.products?.name ?? "-"}</span>
                  </p>
                  <span className="shrink-0 text-xs font-medium text-ink-muted">
                    {p.qty} terjual
                  </span>
                </div>
                <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-canvas-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((p.qty / maxQty) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
