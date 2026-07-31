"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getReports } from "@/lib/actions/reports"
import { Dollar, Receipt, Package, TrendingUp, ChartLine } from "@/components/ui/icons"

type ReportsData = Awaited<ReturnType<typeof getReports>>

function DateBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
        active ? "bg-primary text-on-primary border-primary" : "bg-canvas text-ink-muted border-hairline"
      }`}
    >
      {label}
    </button>
  )
}

export function ReportsView() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("today")

  async function load() {
    setLoading(true)
    const now = new Date()
    let from: string | undefined
    let to: string | undefined

    if (range === "today") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    } else if (range === "week") {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      from = d.toISOString()
    } else if (range === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    }

    setData(await getReports(from, to))
    setLoading(false)
  }

  useEffect(() => { load() }, [range])

  const cards = data ? [
    { label: "Pendapatan", value: `Rp${data.totalRevenue.toLocaleString()}`, icon: Dollar, color: "text-primary" },
    { label: "Transaksi", value: String(data.count), icon: Receipt, color: "text-accent-teal" },
    { label: "Barang Terjual", value: String(data.totalItems), icon: Package, color: "text-accent-orange" },
    { label: "Laba", value: `Rp${data.profit.toLocaleString()}`, icon: TrendingUp, color: "text-accent-green" },
  ] : []

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">Laporan</h1>
        <p className="text-ink-muted text-sm mb-3">Ringkasan penjualan</p>
        <div className="flex gap-1.5">
          <DateBtn label="Hari Ini" active={range === "today"} onClick={() => setRange("today")} />
          <DateBtn label="7 Hari" active={range === "week"} onClick={() => setRange("week")} />
          <DateBtn label="Bulan Ini" active={range === "month"} onClick={() => setRange("month")} />
          <DateBtn label="Semua" active={range === "all"} onClick={() => setRange("all")} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : data ? (
        <>
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
            <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
              <ChartLine className="size-4 text-primary" /> Produk Terlaris
            </h2>
            {data.topProducts.length === 0 ? (
              <p className="text-xs text-ink-faint">Belum ada data</p>
            ) : (
              <div className="space-y-1.5">
                {data.topProducts.slice(0, 10).map((p, i) => (
                  <div key={p.name} className="flex justify-between text-xs">
                    <span className="text-ink-muted">{i + 1}. {p.name}</span>
                    <span className="font-medium text-ink">{p.qty} terjual</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-canvas border border-hairline p-3">
            <h2 className="text-sm font-semibold text-ink mb-2">Riwayat Transaksi</h2>
            {data.transactions.length === 0 ? (
              <p className="text-xs text-ink-faint">Belum ada transaksi</p>
            ) : (
              <div className="space-y-1">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between text-xs py-1 border-b border-hairline last:border-0">
                    <span className="text-ink-muted">
                      {new Date(tx.created_at).toLocaleDateString("id", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-medium text-ink">Rp{tx.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

