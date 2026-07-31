"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getTransactions, getTransactionsSummary, type BxTransaction } from "@/lib/db/queries"
import { Search, Receipt, ChevronRight, TrendingUp, Wallet } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

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
      setHasMore(list.total > list.data.length)
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
    const { data, total } = await getTransactions({
      search: s,
      dateFrom,
      page: transactions.length / PAGE_SIZE,
      pageSize: PAGE_SIZE,
    })
    setTransactions((prev) => [...prev, ...data])
    setHasMore(transactions.length + data.length < total)
    setLoadingMore(false)
  }

  const rangeFilterActive = range !== "all"

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">
          Transaksi
        </h1>
        <p className="text-ink-muted text-sm mb-3">Riwayat penjualan</p>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
          <Input
            placeholder="Cari no. nota atau pembeli..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors",
                range === r.key
                  ? "border-ink bg-ink text-white"
                  : "border-hairline bg-canvas-soft text-ink-muted active:bg-canvas"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-canvas border border-hairline p-3.5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <Wallet className="size-3.5" />
            <span className="text-xs">Pendapatan</span>
          </div>
          <p className="mt-1 text-base font-bold text-ink">
            {loading && !summary ? "…" : fmtRp(summary?.total ?? 0)}
          </p>
        </div>
        <div className="rounded-xl bg-canvas border border-hairline p-3.5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <TrendingUp className="size-3.5" />
            <span className="text-xs">Transaksi</span>
          </div>
          <p className="mt-1 text-base font-bold text-ink">
            {loading && !summary ? "…" : (summary?.count ?? 0)}
          </p>
        </div>
      </div>

      {loading && transactions.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-ink-faint text-sm">
          {search.trim() || rangeFilterActive
            ? "Tidak ada transaksi untuk filter ini"
            : "Belum ada transaksi"}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {transactions.map((tx) => {
              const items = tx.transaction_items ?? []
              const buyer = tx.customers?.name
              return (
                <Link
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  className="flex items-center gap-3 rounded-xl bg-canvas border border-hairline p-3.5"
                >
                  <Receipt className="size-5 text-ink-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium text-ink">
                        {tx.number ?? tx.id.slice(0, 8).toUpperCase()}
                      </p>
                      <span className="shrink-0 rounded-full bg-canvas-soft border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {tx.payment_method ?? "cash"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5 truncate">
                      {fmtRp(tx.total)}
                      {buyer ? ` · ${buyer}` : ""} ·{" "}
                      {new Date(tx.created_at).toLocaleDateString("id", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint shrink-0">{items.length} item</span>
                  <ChevronRight className="size-4 text-ink-faint shrink-0" />
                </Link>
              )
            })}
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
