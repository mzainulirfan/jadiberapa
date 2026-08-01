"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getDashboardSummary,
  type BxDashboardSummary,
  type BxPeriod,
  type BxStat,
} from "@/lib/db/queries"
import { watchTransactions } from "@/lib/db/watch"
import {
  Receipt,
  Package,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Wallet,
  AlertTriangle,
} from "@/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const greeting = (() => {
  const h = new Date().getHours()
  if (h < 11) return "Selamat pagi"
  if (h < 15) return "Selamat siang"
  if (h < 18) return "Selamat sore"
  return "Selamat malam"
})()

const dateLabel = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date())

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

const fmtShort = (n: number) => {
  const sign = n < 0 ? "-" : ""
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a % 1_000_000 === 0 ? 0 : 1)}jt`
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}rb`
  return `${sign}${a}`
}

const PERIODS: { key: BxPeriod; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
]

const COMPARE_LABEL: Record<BxPeriod, string> = {
  today: "vs kemarin",
  "7d": "vs 7 hari lalu",
  "30d": "vs 30 hari lalu",
}

const PERIOD_TITLE: Record<BxPeriod, string> = {
  today: "Hari Ini",
  "7d": "7 Hari Terakhir",
  "30d": "30 Hari Terakhir",
}

const TOP_PRODUCT_BAR = ["bg-accent-orange", "bg-accent-teal", "bg-accent-purple", "bg-accent-green", "bg-accent-sky"]

function DeltaBadge({ stat, dark }: { stat: BxStat; dark?: boolean }) {
  if (stat.pct === null) return null
  const up = stat.pct >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
        dark
          ? "bg-white/10"
          : up
            ? "bg-accent-green/15"
            : "bg-destructive/10",
        up ? "text-accent-green" : dark ? "text-red-300" : "text-destructive"
      )}
    >
      <TrendingUp className={cn("size-3", !up && "-scale-y-100")} />
      {Math.abs(stat.pct).toFixed(0)}%
    </span>
  )
}

function PeriodDropdown({
  value,
  onChange,
}: {
  value: BxPeriod
  onChange: (p: BxPeriod) => void
}) {
  const current = PERIODS.find((p) => p.key === value)?.label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-ink transition-colors outline-none active:bg-canvas-soft data-[popup-open]:bg-canvas-soft">
        {current}
        <ChevronDown className="size-3.5 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as BxPeriod)}>
          {PERIODS.map((p) => (
            <DropdownMenuRadioItem key={p.key} value={p.key} closeOnClick>
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HeroStat({
  label,
  value,
  stat,
}: {
  label: string
  value: string
  stat: BxStat
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-white">{value}</p>
      <div className="mt-1 h-[18px]">
        <DeltaBadge stat={stat} dark />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">{label}</p>
        <Icon className={cn("size-4", tone)} />
      </div>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink p-4">
        <Skeleton className="h-3.5 w-36 rounded-full bg-white/15" />
        <Skeleton className="mt-3 h-8 w-44 rounded-md bg-white/15" />
        <Skeleton className="mt-2 h-3 w-28 rounded-full bg-white/10" />
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-12 rounded-full bg-white/10" />
              <Skeleton className="mt-2 h-4 w-16 rounded-md bg-white/15" />
              <Skeleton className="mt-1.5 h-3 w-8 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-hairline bg-canvas p-3.5">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-2 h-5 w-20 rounded-md" />
        </div>
        <div className="rounded-xl border border-hairline bg-canvas p-3.5">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-2 h-5 w-16 rounded-md" />
          <Skeleton className="mt-1.5 h-2.5 w-20 rounded-full" />
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-canvas p-4">
        <Skeleton className="h-4 w-32 rounded-md" />
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {[...Array(12)].map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${20 + ((i * 37) % 70)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-canvas">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between border-t border-hairline px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-lg" />
              <div>
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-32 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-hairline bg-canvas p-4">
        <Skeleton className="h-4 w-32 rounded-md" />
        <div className="mt-3 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-32 rounded-full" />
                <Skeleton className="h-3 w-12 rounded-full" />
              </div>
              <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardContent({ data }: { data: BxDashboardSummary }) {
  const { period } = data
  const maxTrend = Math.max(...data.trend.map((d) => d.total), 1)
  const avgTrend = data.trend.reduce((s, d) => s + d.total, 0) / data.trend.length
  const allZero = data.trend.every((d) => d.total === 0)
  const many = data.trend.length > 7

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink p-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white/60">Pendapatan · {PERIOD_TITLE[period]}</p>
        </div>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-tight text-white">
          {fmtRp(data.revenue.value)}
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-xs text-white/50">
          <DeltaBadge stat={data.revenue} dark />
          <span>{COMPARE_LABEL[period]}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <HeroStat label="Laba" value={`Rp${fmtShort(data.profit.value)}`} stat={data.profit} />
          <HeroStat label="Transaksi" value={String(data.count.value)} stat={data.count} />
          <HeroStat label="Barang Terjual" value={String(data.items.value)} stat={data.items} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Rata-rata / transaksi"
          value={fmtRp(data.avgOrder)}
          icon={Wallet}
          tone="text-accent-teal"
        />
        <StatCard
          label="Item / transaksi"
          value={data.itemsPerTx.toFixed(1)}
          hint="rata-rata barang"
          icon={Package}
          tone="text-accent-orange"
        />
      </div>

      <div className="rounded-xl border border-hairline bg-canvas p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Grafik Penjualan</h2>
          {!allZero && (
            <span className="text-xs text-ink-faint">Puncak {fmtRp(maxTrend)}</span>
          )}
        </div>
        {allZero ? (
          <div className="flex h-32 items-center justify-center text-xs text-ink-faint">
            Belum ada penjualan
          </div>
        ) : (
          <>
            <div className="relative h-32">
              <div className={cn("absolute inset-0 flex items-end", many ? "gap-px" : "gap-1.5")}>
                {data.trend.map((d, i) => {
                  const last = i === data.trend.length - 1
                  return (
                    <div key={i} className="flex h-full flex-1 flex-col justify-end">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all",
                          last ? "bg-primary" : "bg-primary/25"
                        )}
                        style={{ height: `${Math.max((d.total / maxTrend) * 100, d.total > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              {avgTrend > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink-faint/50"
                  style={{ bottom: `${(avgTrend / maxTrend) * 100}%` }}
                />
              )}
            </div>
            <div className={cn("mt-1.5 flex", many ? "gap-px" : "gap-1.5")}>
              {data.trend.map((d, i) => (
                <p key={i} className="flex-1 truncate text-center text-[10px] text-ink-faint">
                  {many ? (i % 5 === 0 || i === data.trend.length - 1 ? d.label : "") : d.label}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      {data.lowStock.length > 0 && (
        <div className="rounded-xl border border-accent-orange/20 bg-accent-orange-deep/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <AlertTriangle className="size-4 text-accent-orange" />
              Stok Menipis
            </h2>
            <Link
              href="/products"
              className="flex items-center gap-0.5 text-xs font-medium text-primary"
            >
              Kelola
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {data.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="truncate text-ink">{p.name}</span>
                <span className="ml-2 shrink-0 rounded-full border border-hairline bg-canvas px-2 py-0.5 font-semibold text-accent-orange">
                  sisa {p.stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-hairline bg-canvas">
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
        {data.recent.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-ink-faint">Belum ada transaksi</p>
        ) : (
          <div>
            {data.recent.map((tx) => (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className="flex items-center justify-between border-t border-hairline px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
                    <Receipt className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-ink">
                      {tx.number ?? tx.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {tx.customers?.name
                        ? `${tx.customers.name} · ${timeFormat.format(new Date(tx.created_at))}`
                        : timeFormat.format(new Date(tx.created_at))}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-ink">{fmtRp(tx.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-hairline bg-canvas p-4">
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
        {data.topProducts.length === 0 ? (
          <p className="text-xs text-ink-faint">Belum ada data</p>
        ) : (
          <div className="space-y-3">
            {data.topProducts.map((p, i) => {
              const maxQty = Math.max(...data.topProducts.map((x) => x.qty), 1)
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-xs font-semibold text-ink-faint">{i + 1}</span>
                      <span className="truncate text-ink">{p.name}</span>
                    </p>
                    <span className="shrink-0 text-xs font-medium text-ink-muted">
                      {p.qty} terjual
                    </span>
                  </div>
                  <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-canvas-soft">
                    <div
                      className={cn("h-full rounded-full", TOP_PRODUCT_BAR[i % TOP_PRODUCT_BAR.length])}
                      style={{ width: `${Math.max((p.qty / maxQty) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardView() {
  const [period, setPeriod] = useState<BxPeriod>("today")
  const [data, setData] = useState<BxDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function refresh() {
      const summary = await getDashboardSummary(period)
      if (active) {
        setData(summary)
        setLoading(false)
      }
    }
    refresh()

    // Debounce agar beberapa perubahan beruntun (mis. satu transaksi + banyak item)
    // tidak memicu banyak reload berat.
    let timer: ReturnType<typeof setTimeout> | null = null
    const reload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        getDashboardSummary(period).then((summary) => {
          if (active) setData(summary)
        })
      }, 500)
    }
    const unsub = watchTransactions(reload)
    // Cukup visibilitychange (mencakup kembali ke tab/app); hindari duplikasi dengan focus.
    const onVisible = () => {
      if (document.visibilityState === "visible") reload()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      unsub()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [period])

  function changePeriod(p: BxPeriod) {
    if (p === period) return
    setLoading(true)
    setPeriod(p)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-ink">{greeting} 👋</p>
          <p className="truncate text-sm text-ink-muted">{dateLabel}</p>
        </div>
        <PeriodDropdown value={period} onChange={changePeriod} />
      </div>

      {loading || !data ? <DashboardSkeleton /> : <DashboardContent data={data} />}
    </div>
  )
}
