"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getReports, type BxReports } from "@/lib/db/queries"
import { ChartLine, ChevronDown, ChevronRight, Share, Wallet } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type ReportsData = BxReports
type RangeKey = "today" | "week" | "month" | "all"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "7 Hari" },
  { key: "month", label: "Bulan Ini" },
  { key: "all", label: "Semua" },
]

const PAYMENT_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS", dana: "DANA" }

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function fromForRange(range: RangeKey): string | undefined {
  const now = new Date()
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (range === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return undefined
}

function PeriodDropdown({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const current = RANGES.find((r) => r.key === value)?.label ?? "Periode"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors outline-none active:bg-canvas-soft data-[popup-open]:bg-canvas-soft">
        {current}
        <ChevronDown className="size-3.5 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as RangeKey)}>
          {RANGES.map((r) => (
            <DropdownMenuRadioItem key={r.key} value={r.key} closeOnClick>
              {r.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Ubah bucket tren dari RPC menjadi label siap-tampil sesuai periode.
// Data sudah teragregasi & dibatasi 14 titik terakhir (urut naik) di SQL.
function trendLabels(trend: { t: string; value: number }[], range: RangeKey) {
  return trend.map((b) => ({
    label:
      range === "today"
        ? `${b.t.padStart(2, "0")}.00`
        : new Date(`${b.t}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    value: b.value,
  }))
}

export function ReportsView() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>("today")

  function changeRange(next: RangeKey) {
    setLoading(true)
    setRange(next)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await getReports(fromForRange(range), range === "today" ? "hour" : "day")
      if (active) {
        setData(result)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [range])

  const periodLabel = RANGES.find((r) => r.key === range)?.label ?? ""
  const marginPct = data && data.totalRevenue > 0 ? `${Math.round((data.profit / data.totalRevenue) * 100)}%` : "–"

  async function share() {
    if (!data) return
    const lines = [
      `📊 Laporan ${periodLabel}`,
      `Omzet: ${fmtRp(data.totalRevenue)}`,
      `Laba: ${fmtRp(data.profit)} (${marginPct})`,
      `Transaksi: ${data.count}`,
      `Barang terjual: ${data.totalItems}`,
    ]
    if (data.topProducts.length) {
      lines.push(`Terlaris: ${data.topProducts.slice(0, 3).map((p) => p.name).join(", ")}`)
    }
    const text = lines.join("\n")
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ text })
      } catch {
        /* dibatalkan pengguna */
      }
      return
    }
    await navigator.clipboard.writeText(text)
    toast.success("Ringkasan disalin")
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <PeriodDropdown value={range} onChange={changeRange} />
        <button
          onClick={share}
          disabled={loading || !data || data.count === 0}
          className="flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors active:bg-canvas-soft disabled:opacity-50"
        >
          <Share className="size-3.5" /> Bagikan
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : data ? (
        <Content data={data} range={range} periodLabel={periodLabel} marginPct={marginPct} />
      ) : null}
    </div>
  )
}

function Content({
  data,
  range,
  periodLabel,
  marginPct,
}: {
  data: ReportsData
  range: RangeKey
  periodLabel: string
  marginPct: string
}) {
  const avg = data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0
  const trend = trendLabels(data.trend, range)
  const trendMax = Math.max(1, ...trend.map((t) => t.value))
  const peak = trend.reduce((m, t) => (t.value > m ? t.value : m), 0)

  const payment = data.payment.map((p) => ({
    key: p.key,
    label: PAYMENT_LABEL[p.key] ?? p.key,
    value: p.value,
  }))

  const top = data.topProducts.slice(0, 8)
  const maxQty = Math.max(1, ...top.map((p) => p.qty))

  return (
    <>
      {/* Hero — kartu terang beraksen */}
      <div className="rounded-2xl border border-hairline border-l-4 border-l-primary bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-4" />
          </span>
          <p className="text-sm font-medium text-ink-muted">Pendapatan · {periodLabel}</p>
        </div>
        <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-ink">
          {fmtRp(data.totalRevenue)}
        </p>
        <div className="mt-3 flex items-center gap-6 border-t border-hairline pt-3">
          <div>
            <p className="text-[11px] text-ink-faint">Laba</p>
            <p className="mt-0.5 text-sm font-bold text-accent-green">{fmtRp(data.profit)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-faint">Margin</p>
            <p className="mt-0.5 text-sm font-bold text-ink">{marginPct}</p>
          </div>
        </div>
      </div>

      {/* Statistik sekunder */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Transaksi" value={String(data.count)} />
        <StatCard label="Barang Terjual" value={String(data.totalItems)} />
        <StatCard label="Rata-rata/Transaksi" value={fmtRp(avg)} />
      </div>

      {data.count === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">Belum ada transaksi pada periode ini</p>
      ) : (
        <>
          {/* Tren omzet */}
          {trend.length > 0 && (
            <div className="rounded-xl border border-hairline bg-canvas p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Tren Omzet</h2>
                <span className="text-xs text-ink-faint">Puncak {fmtRp(peak)}</span>
              </div>
              <div className="flex h-24 items-end gap-1">
                {trend.map((b, i) => (
                  <div
                    key={i}
                    className={cn("flex-1 rounded-sm", b.value === peak ? "bg-primary" : "bg-primary/25")}
                    style={{ height: `${Math.max((b.value / trendMax) * 100, 3)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
                <span>{trend[0].label}</span>
                <span>{trend[trend.length - 1].label}</span>
              </div>
            </div>
          )}

          {/* Metode pembayaran */}
          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <h2 className="mb-3 text-sm font-semibold text-ink">Metode Pembayaran</h2>
            <div className="space-y-2.5">
              {payment.map((p) => {
                const pct = data.totalRevenue > 0 ? (p.value / data.totalRevenue) * 100 : 0
                return (
                  <div key={p.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">{p.label}</span>
                      <span className="font-medium text-ink">
                        {fmtRp(p.value)} · {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas-soft">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Produk terlaris */}
          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ChartLine className="size-4 text-primary" /> Produk Terlaris
            </h2>
            {top.length === 0 ? (
              <p className="text-xs text-ink-faint">Belum ada data</p>
            ) : (
              <div className="space-y-2.5">
                {top.map((p, i) => (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate text-ink-muted">
                        {i + 1}. {p.name}
                      </span>
                      <span className="shrink-0 font-medium text-ink">
                        {p.qty} terjual · {fmtRp(p.total)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas-soft">
                      <div
                        className="h-full rounded-full bg-accent-teal"
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/transactions"
            className="flex items-center justify-center gap-1 rounded-xl border border-hairline bg-canvas p-3 text-sm font-medium text-ink-muted transition-colors active:bg-canvas-soft"
          >
            Lihat semua transaksi <ChevronRight className="size-4" />
          </Link>
        </>
      )}
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-3">
      <p className="truncate text-[11px] text-ink-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
