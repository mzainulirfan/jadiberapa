"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getTransactions } from "@/lib/actions/transactions"
import { Receipt, ChevronRight } from "@/components/ui/icons"

type Tx = Awaited<ReturnType<typeof getTransactions>>["transactions"][number]

export function TransactionsView() {
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { transactions, error } = await getTransactions()
    setTransactions(transactions)
    setError(error)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">
          Transaksi
        </h1>
        <p className="text-ink-muted text-sm">Riwayat penjualan</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-ink-faint text-sm">Belum ada transaksi</div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const items = tx.transaction_items ?? []
            const isOpen = openId === tx.id
            return (
              <div
                key={tx.id}
                className="rounded-xl bg-canvas border border-hairline overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : tx.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left"
                >
                  <Receipt className="size-5 text-ink-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        Rp{tx.total.toLocaleString()}
                      </p>
                      <span className="shrink-0 rounded-full bg-canvas-soft border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {tx.payment_method ?? "cash"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("id", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint shrink-0">{items.length} item</span>
                  <ChevronRight
                    className={`size-4 text-ink-faint shrink-0 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-hairline p-3.5 space-y-2">
                    {items.map((item: { id: string; qty: number; subtotal: number; products?: { name: string } | null }) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-ink-muted">
                          {item.qty} x {item.products?.name ?? "Produk dihapus"}
                        </span>
                        <span className="font-medium text-ink">
                          Rp{item.subtotal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
