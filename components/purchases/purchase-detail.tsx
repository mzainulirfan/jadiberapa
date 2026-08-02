"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getPurchase, type BxPurchaseDetail, type BxSupplierPayment } from "@/lib/db/queries"
import { recordSupplierPayment } from "@/lib/actions/purchases"
import { Receipt, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function fmtDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

export function PurchaseDetail({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<BxPurchaseDetail | null>(null)
  const [payments, setPayments] = useState<BxSupplierPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPay, setShowPay] = useState(false)
  const [payInput, setPayInput] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPurchase(id).then(({ purchase, error }) => {
      setPurchase(purchase)
      setError(error)
      if (purchase) setPayments(purchase.payments)
      setLoading(false)
    })
  }, [id])

  const remaining = purchase ? Math.max(0, purchase.total - purchase.paid_amount) : 0
  const payAmount = Number(payInput.replace(/[^\d]/g, "")) || 0

  function handlePayChange(value: string) {
    const digits = value.replace(/[^\d]/g, "")
    setPayInput(digits ? Number(digits).toLocaleString("id-ID") : "")
  }

  async function handleRecordPayment() {
    if (!purchase || payAmount <= 0) return
    setSaving(true)
    const res = await recordSupplierPayment(purchase.id, Math.min(payAmount, remaining))
    setSaving(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success("Pembayaran tercatat")
    setShowPay(false)
    setPayInput("")
    const { purchase: fresh } = await getPurchase(id)
    setPurchase(fresh)
    if (fresh) setPayments(fresh.payments)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="mt-3 space-y-2.5 border-t border-hairline pt-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-hairline bg-canvas">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t border-hairline px-4 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <Skeleton className="mt-1.5 h-3 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ) : error || !purchase ? (
          <p className="text-sm text-destructive">{error ?? "Pembelian tidak ditemukan"}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Total</span>
                <span className="text-lg font-bold text-ink">{fmtRp(purchase.total)}</span>
              </div>
              <div className="mt-3 space-y-2 border-t border-hairline pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Supplier</span>
                  <span className="font-medium text-ink">
                    {purchase.supplier_name ?? "Supplier dihapus"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Status</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      purchase.status === "utang"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {purchase.status === "utang" ? "Belum Lunas" : "Lunas"}
                  </span>
                </div>
                {purchase.status === "utang" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">Sudah Dibayar</span>
                      <span className="font-medium text-ink">{fmtRp(purchase.paid_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">Sisa Utang</span>
                      <span className="font-semibold text-destructive">{fmtRp(remaining)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Nomor Nota</span>
                  <span className="font-mono text-sm font-medium text-ink">{purchase.number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Tanggal</span>
                  <span className="font-medium text-ink">{fmtDate(purchase.created_at)}</span>
                </div>
                {purchase.cashier_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Dicatat oleh</span>
                    <span className="font-medium text-ink">{purchase.cashier_name}</span>
                  </div>
                )}
                {purchase.note && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="shrink-0 text-ink-muted">Catatan</span>
                    <span className="text-right font-medium text-ink">{purchase.note}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h2 className="text-sm font-semibold text-ink">Barang</h2>
                <span className="text-xs text-ink-faint">{purchase.items.length} item</span>
              </div>
              {purchase.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-t border-hairline px-4 py-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
                    <Package className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.product_name ?? "Produk dihapus"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {item.qty} × {fmtRp(item.price_buy)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {fmtRp(item.subtotal)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                <span className="text-sm font-medium text-ink-muted">Total</span>
                <span className="text-lg font-bold text-ink">{fmtRp(purchase.total)}</span>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="rounded-xl border border-hairline bg-canvas">
                <div className="px-4 pt-3.5 pb-2">
                  <h2 className="text-sm font-semibold text-ink">Riwayat Pembayaran</h2>
                </div>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-t border-hairline px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {p.note || (p.method === "cash" ? "Tunai" : p.method)}
                      </p>
                      <p className="text-xs text-ink-faint">{fmtDate(p.created_at)}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{fmtRp(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {purchase && remaining > 0 && (
        <div className="border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            className="h-11 w-full rounded-full"
            onClick={() => {
              setPayInput("")
              setShowPay(true)
            }}
          >
            <Receipt className="size-4" />
            Catat Pembayaran
          </Button>
        </div>
      )}

      <Dialog open={showPay} onOpenChange={(o) => !saving && setShowPay(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas-soft p-3 text-sm">
              <span className="text-ink-muted">Sisa utang</span>
              <span className="font-semibold text-destructive">{fmtRp(remaining)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Nominal bayar"
                  value={payInput}
                  onChange={(e) => handlePayChange(e.target.value)}
                  className="text-base font-semibold"
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setPayInput(remaining.toLocaleString("id-ID"))}
              >
                Lunasi
              </Button>
            </div>
            <Button
              className="h-11 w-full rounded-full"
              disabled={saving || payAmount <= 0}
              onClick={handleRecordPayment}
            >
              {saving ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
