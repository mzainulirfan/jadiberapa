"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getDebts, getSettings, type BxDebt } from "@/lib/db/queries"
import { Skeleton } from "@/components/ui/skeleton"
import { Wallet, ChevronRight, Whatsapp } from "@/components/ui/icons"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "")
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
}

type Group = {
  key: string
  name: string
  phone: string | null
  remaining: number
  debts: BxDebt[]
}

export function DebtsView() {
  const [debts, setDebts] = useState<BxDebt[] | null>(null)
  const [storeName, setStoreName] = useState("Toko")

  useEffect(() => {
    getSettings().then((s) => setStoreName(s.store_name?.trim() || "Toko"))
  }, [])

  useEffect(() => {
    let active = true
    getDebts().then((d) => {
      if (active) setDebts(d)
    })
    return () => {
      active = false
    }
  }, [])

  const { groups, totalRemaining, totalDebt, totalPaid } = useMemo(() => {
    const map = new Map<string, Group>()
    let total = 0
    let debt = 0
    for (const d of debts ?? []) {
      const remaining = Math.max(0, d.total - d.paid_amount)
      total += remaining
      debt += d.total
      const key = d.customer_id ?? "umum"
      const name = d.customer_name ?? "Umum (tanpa pembeli)"
      const g = map.get(key) ?? { key, name, phone: null, remaining: 0, debts: [] }
      g.phone = d.customer_phone ?? g.phone
      g.remaining += remaining
      g.debts.push(d)
      map.set(key, g)
    }
    const groups = [...map.values()].sort((a, b) => b.remaining - a.remaining)
    return { groups, totalRemaining: total, totalDebt: debt, totalPaid: debt - total }
  }, [debts])

  function reminderText(g: Group) {
    return `Halo ${g.name}, kami dari ${storeName}. Anda masih memiliki tagihan utang sebesar ${fmtRp(g.remaining)}. Mohon konfirmasi kapan bisa melunasi ya. Terima kasih.`
  }

  if (debts === null) {
    return (
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="mt-2 h-7 w-40 rounded-md" />
          <Skeleton className="mt-2 h-3 w-32 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="mt-1.5 h-3 w-28 rounded-full" />
                </div>
                <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
                <Skeleton className="size-4 shrink-0 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
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
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Wallet className="size-4" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Total Utang Belum Lunas
          </p>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-destructive">
          {fmtRp(totalRemaining)}
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-canvas-soft">
          <div
            className="h-full rounded-full bg-accent-green"
            style={{ width: `${totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          {debts.length} transaksi · {groups.length} pembeli
          {totalPaid > 0 && ` · sudah dibayar ${fmtRp(totalPaid)}`}
        </p>
      </div>

      {groups.map((g) => {
        const gTotal = g.debts.reduce((s, d) => s + d.total, 0)
        const gPaidPct = gTotal > 0 ? ((gTotal - g.remaining) / gTotal) * 100 : 0
        return (
          <div key={g.key} className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-ink">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-canvas-soft text-[10px] font-bold text-ink-muted">
                  {g.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{g.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {g.phone && (
                  <a
                    href={waLink(g.phone, reminderText(g))}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${g.name}`}
                    className="flex size-6 items-center justify-center rounded-lg text-accent-green active:bg-canvas-soft"
                  >
                    <Whatsapp className="size-3.5" />
                  </a>
                )}
                <span className="text-xs font-semibold text-destructive">{fmtRp(g.remaining)}</span>
              </span>
            </div>
            <div className="mx-1 h-1 rounded-full bg-canvas-soft">
              <div className="h-full rounded-full bg-accent-green" style={{ width: `${gPaidPct}%` }} />
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
        )
      })}
    </div>
  )
}
