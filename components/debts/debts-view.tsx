"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getDebts, type BxDebt } from "@/lib/db/queries"
import { Skeleton } from "@/components/ui/skeleton"
import { Wallet, ChevronRight, User } from "@/components/ui/icons"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type Group = {
  key: string
  name: string
  remaining: number
  debts: BxDebt[]
}

export function DebtsView() {
  const [debts, setDebts] = useState<BxDebt[] | null>(null)

  useEffect(() => {
    let active = true
    getDebts().then((d) => {
      if (active) setDebts(d)
    })
    return () => {
      active = false
    }
  }, [])

  const { groups, totalRemaining } = useMemo(() => {
    const map = new Map<string, Group>()
    let total = 0
    for (const d of debts ?? []) {
      const remaining = Math.max(0, d.total - d.paid_amount)
      total += remaining
      const key = d.customer_id ?? "umum"
      const name = d.customer_name ?? "Umum (tanpa pembeli)"
      const g = map.get(key) ?? { key, name, remaining: 0, debts: [] }
      g.remaining += remaining
      g.debts.push(d)
      map.set(key, g)
    }
    const groups = [...map.values()].sort((a, b) => b.remaining - a.remaining)
    return { groups, totalRemaining: total }
  }, [debts])

  if (debts === null) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (debts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-canvas-soft text-ink-faint">
          <Wallet className="size-6" />
        </span>
        <p className="text-sm text-ink-muted">Belum ada utang pembeli</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-hairline bg-canvas p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Total Utang Belum Lunas
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-destructive">
          {fmtRp(totalRemaining)}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          {debts.length} transaksi · {groups.length} pembeli
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <User className="size-3.5" />
              {g.name}
            </span>
            <span className="text-xs font-semibold text-destructive">
              {fmtRp(g.remaining)}
            </span>
          </div>
          <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
            {g.debts.map((d) => {
              const remaining = Math.max(0, d.total - d.paid_amount)
              return (
                <Link
                  key={d.id}
                  href={`/transactions/${d.id}`}
                  className="flex items-center gap-3 p-3.5 transition-colors active:bg-canvas-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium text-ink">
                      {d.number ?? d.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {fmtDate(d.created_at)}
                      {d.paid_amount > 0 && ` · dibayar ${fmtRp(d.paid_amount)}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-destructive">
                    {fmtRp(remaining)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
