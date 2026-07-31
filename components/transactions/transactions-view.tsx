"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getTransactions, getTransactionsSummary, type BxTransaction } from "@/lib/db/queries"
import { Search, Receipt, ChevronRight, ChevronDown, Wallet, X } from "@/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type RangeKey = "today" | "7d" | "30d" | "all"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "all", label: "Semua" },
]

const PAGE_SIZE = 20

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dateFromFor(range: RangeKey): string | null {
  const now = new Date()
  switch (range) {
    case "today":
      return startOfDay(now).toISOString()
    case "7d": {
      const d = startOfDay(now)
      d.setDate(d.getDate() - 6)
      return d.toISOString()
    }
    case "30d": {
      const d = startOfDay(now)
      d.setDate(d.getDate() - 29)
      return d.toISOString()
    }
    default:
      return null
  }
}

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

const dayHeaderFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
})

function dayLabel(d: Date): string {
  const diff = (startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000
  if (diff === 0) return "Hari Ini"
  if (diff === 1) return "Kemarin"
  return dayHeaderFmt.format(d)
}

const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" })

type TxGroup = { key: string; label: string; items: BxTransaction[] }

function groupByDay(list: BxTransaction[]): TxGroup[] {
  const groups: TxGroup[] = []
  let current: TxGroup | null = null
  for (const tx of list) {
    const d = new Date(tx.created_at)
    const key = startOfDay(d).toISOString()
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(d), items: [] }
      groups.push(current)
    }
    current.items.push(tx)
  }
  return groups
}

function PeriodDropdown({
  value,
  onChange,
}: {
  value: RangeKey
  onChange: (r: RangeKey) => void
}) {
  const current = RANGES.find((r) => r.key === value)?.label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors outline-none active:bg-canvas-soft data-[popup-open]:bg-canvas-soft">
        {current}
        <ChevronDown className="size-3.5 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
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

function TxRow({ tx }: { tx: BxTransaction }) {
  const buyer = tx.customer_name
  const subtitle = [buyer, timeFmt.format(new Date(tx.created_at)), `${tx.item_count} item`]
    .filter(Boolean)
    .join(" · ")
  return (
    <Link
      href={`/transactions/${tx.id}`}
      className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3.5 transition-colors active:bg-canvas-soft"
    >
      <Receipt className="size-5 shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-sm font-semibold text-ink">
            {tx.number ?? tx.id.slice(0, 8).toUpperCase()}
          </p>
          <span className="shrink-0 rounded-full border border-hairline bg-canvas-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
            {tx.payment_method ?? "cash"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-faint">{subtitle}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-ink">{fmtRp(tx.total)}</p>
      <ChevronRight className="size-4 shrink-0 text-ink-faint" />
    </Link>
  )
}

export function TransactionsView() {
  const [transactions, setTransactions] = useState<BxTransaction[]>([])
  const [summary, setSummary] = useState<{ count: number; total: number } | null>(null)
  const [range, setRange] = useState<RangeKey>("today")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    const dateFrom = dateFromFor(range)
    const s = search.trim() || undefined
    const t = setTimeout(async () => {
      setLoading(true)
      const [list, sum] = await Promise.all([
        getTransactions({ search: s, dateFrom, pageSize: PAGE_SIZE }),
        getTransactionsSummary({ search: s, dateFrom }),
      ])
      if (cancelled) return
      setTransactions(list.data)
      setSummary(sum)
      setHasMore(list.hasMore)
      setError(null)
      setLoading(false)
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [range, search])

  async function loadMore() {
    setLoadingMore(true)
    const dateFrom = dateFromFor(range)
    const s = search.trim() || undefined
    const { data, hasMore: more } = await getTransactions({
      search: s,
      dateFrom,
      page: transactions.length / PAGE_SIZE,
      pageSize: PAGE_SIZE,
    })
    setTransactions((prev) => [...prev, ...data])
    setHasMore(more)
    setLoadingMore(false)
  }

  const rangeFilterActive = range !== "all"
  const groups = groupByDay(transactions)

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Cari no. nota atau pembeli..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-8 ${search ? "pr-9" : ""}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Hapus pencarian"
              className="absolute inset-y-0 right-0 flex items-center rounded-r-lg pl-2 pr-2.5 text-ink-muted active:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <PeriodDropdown value={range} onChange={setRange} />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-ink-faint" />
          <span className="text-xs text-ink-faint">Pendapatan</span>
          <span className="text-sm font-bold text-ink">
            {loading && !summary ? "…" : fmtRp(summary?.total ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-hairline pl-3">
          <span className="text-sm font-bold text-ink">
            {loading && !summary ? "…" : (summary?.count ?? 0)}
          </span>
          <span className="text-xs text-ink-faint">transaksi</span>
        </div>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-faint">
          {search.trim() || rangeFilterActive
            ? "Tidak ada transaksi untuk filter ini"
            : "Belum ada transaksi"}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <p className="px-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  {g.label}
                </p>
                <div className="space-y-2">
                  {g.items.map((tx) => (
                    <TxRow key={tx.id} tx={tx} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Memuat..." : "Muat lebih"}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
