"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardData } from "@/lib/actions/dashboard"
import { Receipt, Package, Dollar } from "@/components/ui/icons"

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

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
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const cards = [
    { label: "Penjualan Hari Ini", value: `Rp${data.todayTotal.toLocaleString()}`, icon: Dollar, color: "text-primary" },
    { label: "Transaksi", value: String(data.todayCount), icon: Receipt, color: "text-accent-teal" },
    { label: "Barang Terjual", value: String(data.todayItems), icon: Package, color: "text-accent-orange" },
  ]

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">Dashboard</h1>
        <p className="text-ink-muted text-sm">Ringkasan penjualan hari ini</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl bg-canvas border border-hairline p-3">
              <Icon className={`size-5 ${card.color} mb-1`} />
              <p className="text-xs text-ink-muted">{card.label}</p>
              <p className="text-sm font-semibold text-ink mt-0.5">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-canvas border border-hairline p-3">
        <h2 className="text-sm font-semibold text-ink mb-2">Transaksi Terbaru</h2>
        {data.recentTransactions.length === 0 ? (
          <p className="text-xs text-ink-faint">Belum ada transaksi</p>
        ) : (
          <div className="space-y-1">
            {data.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex justify-between text-xs">
                <span className="text-ink-muted">
                  {new Date(tx.created_at).toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-medium text-ink">Rp{tx.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-canvas border border-hairline p-3">
        <h2 className="text-sm font-semibold text-ink mb-2">Produk Terlaris</h2>
        {data.topProducts.length === 0 ? (
          <p className="text-xs text-ink-faint">Belum ada data</p>
        ) : (
          <div className="space-y-1">
            {data.topProducts.map((p: any, i: number) => (
              <div key={`${p.product_id}-${i}`} className="flex justify-between text-xs">
                <span className="text-ink-muted">{i + 1}. {p.products?.name ?? "-"}</span>
                <span className="font-medium text-ink">{p.qty} terjual</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

