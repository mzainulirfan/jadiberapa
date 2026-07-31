"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createTransaction } from "@/lib/actions/transactions"
import { getSettings } from "@/lib/actions/settings"
import { getProducts } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import { ProductCard } from "@/components/cashier/product-card"
import {
  Minus,
  Plus,
  Trash,
  ChevronLeft,
  ChevronRight,
  Dollar,
  Qr,
  Wallet,
  Check,
  Copy,
  Package,
} from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { BxProduct } from "@/components/products/types"

type PaymentMethod = "cash" | "qris" | "dana"

const methods: { id: PaymentMethod; label: string; icon: typeof Dollar }[] = [
  { id: "cash", label: "Tunai", icon: Dollar },
  { id: "qris", label: "QRIS", icon: Qr },
  { id: "dana", label: "DANA", icon: Wallet },
]

export function CartView() {
  const { items, addItem, updateQty, removeItem, clearCart, total, count } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paid, setPaid] = useState("")
  const [payConfig, setPayConfig] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [paySheetOpen, setPaySheetOpen] = useState(false)
  const [popular, setPopular] = useState<BxProduct[]>([])
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const router = useRouter()

  useEffect(() => {
    getSettings().then(setPayConfig)
  }, [])

  useEffect(() => {
    if (items.length === 0) {
      getProducts({ limit: 8 }).then(({ data }) => setPopular(data))
    }
  }, [items.length])

  const paidAmount = Number(paid.replace(/[^\d]/g, "")) || 0
  const change = paidAmount - total
  const qrisPayload = payConfig.qris_payload ?? ""
  const danaNumber = payConfig.dana_number ?? ""

  function handlePaidChange(value: string) {
    const digits = value.replace(/[^\d]/g, "")
    setPaid(digits ? Number(digits).toLocaleString("id-ID") : "")
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(danaNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function addPopular(p: BxProduct) {
    const inCart = items.find((i) => i.product.id === p.id)
    if (inCart && inCart.qty >= p.stock) return
    addItem(p)
    popKeyRef.current += 1
    setPop({ id: p.id, key: popKeyRef.current })
  }

  function handleClear() {
    clearCart()
    setConfirmClear(false)
    toast.success("Keranjang dikosongkan")
  }

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    const payload = items.map((i) => ({
      product_id: i.product.id,
      qty: i.qty,
      price_sell: i.product.price_sell,
      subtotal: i.product.price_sell * i.qty,
    }))
    const { error: err } = await createTransaction(payload, method)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    clearCart()
    router.push("/transactions")
  }

  const canCheckout =
    method === "cash"
      ? paidAmount >= total && paidAmount > 0
      : method === "qris"
        ? !!qrisPayload
        : !!danaNumber

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-4 pb-3">
        <Link href="/cashier" className="rounded-full p-1.5 -ml-1.5 text-ink-muted">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
          Keranjang
        </h1>
        <span className="text-ink-faint text-sm">({count})</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive hover:bg-canvas-soft"
          >
            <Trash className="size-4" />
            Hapus Semua
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <div className="text-center py-8">
            <p className="text-ink-faint text-sm">Keranjang kosong</p>
            <p className="text-ink-faint text-xs mt-1">
              Tambah dari barang populer di bawah atau dari Kasir
            </p>
          </div>
          <p className="text-sm font-semibold text-ink-muted mb-2">Barang Populer</p>
          {popular.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {popular.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  qty={0}
                  popKey={pop?.id === p.id ? pop.key : 0}
                  onAdd={() => addPopular(p)}
                />
              ))}
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => router.push("/cashier")}
            >
              Tambah Barang dari Kasir
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-1">
            {items.map((item) => {
              const { product, qty } = item
              const out = product.stock <= 0
              const atMax = qty >= product.stock
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl bg-canvas border border-hairline p-3"
                >
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas-soft text-ink-faint">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Package className="size-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{product.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Rp{product.price_sell.toLocaleString()}
                    </p>
                    {!out && product.stock <= 5 && (
                      <p className="text-[11px] font-medium text-amber-600 mt-0.5">
                        Stok {product.stock}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => updateQty(product.id, qty - 1)}
                        className="flex size-7 items-center justify-center rounded-md border border-hairline text-ink-muted active:bg-canvas-soft"
                        aria-label="Kurangi"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold text-ink">{qty}</span>
                      <button
                        onClick={() => updateQty(product.id, qty + 1)}
                        disabled={atMax}
                        className="flex size-7 items-center justify-center rounded-md border border-hairline text-ink-muted active:bg-canvas-soft disabled:opacity-40"
                        aria-label="Tambah"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="rounded-md p-1 text-ink-muted active:bg-canvas-soft"
                      aria-label="Hapus"
                    >
                      <Trash className="size-4" />
                    </button>
                    <p className="text-sm font-semibold text-ink">
                      Rp{(product.price_sell * qty).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-hairline bg-canvas p-4 space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-ink-muted text-sm pb-1">Total Bayar</span>
              <span className="text-2xl font-bold tracking-tight text-ink">
                Rp{total.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2">
              {methods.map((m) => {
                const Icon = m.icon
                const selected = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-ink"
                        : "border-hairline bg-canvas-soft text-ink-muted"
                    )}
                  >
                    <Icon className={cn("size-4", selected ? "text-primary" : "text-ink-faint")} />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {method === "cash" && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Uang diterima"
                      value={paid}
                      onChange={(e) => handlePaidChange(e.target.value)}
                      className="text-base font-semibold"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPaid(total ? total.toLocaleString("id-ID") : "")}
                  >
                    Uang Pas
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{change < 0 ? "Kurang" : "Kembalian"}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      change < 0 ? "text-destructive" : "text-primary"
                    )}
                  >
                    Rp{Math.abs(change).toLocaleString()}
                  </span>
                </div>
              </>
            )}

            {method === "qris" &&
              (qrisPayload ? (
                <button
                  type="button"
                  onClick={() => setPaySheetOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas-soft p-3 text-left"
                >
                  <span className="flex items-center gap-2">
                    <Qr className="size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-medium text-ink">QRIS</span>
                      <span className="block text-xs text-ink-muted">
                        Ketuk untuk menampilkan kode QR
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-ink-faint" />
                </button>
              ) : (
                <p className="text-sm text-ink-muted bg-canvas-soft border border-hairline rounded-xl p-3 text-center">
                  Kode QRIS belum diatur. Tambahkan di{" "}
                  <Link href="/settings" className="text-primary font-medium underline">
                    Pengaturan
                  </Link>
                  .
                </p>
              ))}

            {method === "dana" &&
              (danaNumber ? (
                <button
                  type="button"
                  onClick={() => setPaySheetOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas-soft p-3 text-left"
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-medium text-ink">DANA</span>
                      <span className="block text-xs text-ink-muted">{danaNumber}</span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-ink-faint" />
                </button>
              ) : (
                <p className="text-sm text-ink-muted bg-canvas-soft border border-hairline rounded-xl p-3 text-center">
                  Nomor DANA belum diatur. Tambahkan di{" "}
                  <Link href="/settings" className="text-primary font-medium underline">
                    Pengaturan
                  </Link>
                  .
                </p>
              ))}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              onClick={handleCheckout}
              disabled={loading || !canCheckout}
              className="w-full rounded-full h-12 text-base"
            >
              {loading ? "Memproses..." : "Bayar"}
            </Button>
          </div>
        </>
      )}

      <Dialog open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold">
              {method === "qris" ? "QRIS" : "DANA"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {method === "qris" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={qrisPayload} size={220} marginSize={0} />
                </div>
                <p className="text-xs text-ink-muted text-center">
                  Minta pelanggan scan QRIS ini untuk membayar
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas-soft p-4">
                <div>
                  <p className="text-xs text-ink-muted mb-0.5">Nomor DANA</p>
                  <p className="text-lg font-semibold text-ink">{danaNumber}</p>
                </div>
                <Button variant="outline" className="rounded-full gap-1.5" onClick={handleCopy}>
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setPaySheetOpen(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={(o) => !o && setConfirmClear(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Kosongkan Keranjang?</DialogTitle>
            <DialogDescription>
              Semua barang di keranjang akan dihapus dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
