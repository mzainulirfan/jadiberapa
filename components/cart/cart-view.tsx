"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
import { getProducts, resolveDiscountAmount } from "@/lib/db/queries"
import { cartKey, priceOf, maxQtyFor, useCart, type CartItem } from "@/components/cart/cart-provider"
import {
  getHeldCarts,
  getHeldCart,
  saveHeldCart,
  deleteHeldCart,
  type HeldCart,
} from "@/lib/db/held-carts"
import { ProductCard } from "@/components/cashier/product-card"
import { Minus, Plus, Trash, Package, ChevronRight } from "@/components/ui/icons"
import type { BxProduct } from "@/components/products/types"

const heldDateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function CartView() {
  const { items, addItem, updateQty, removeItem, clearCart, replaceCart, netTotal, discounts, count, customer, setCustomer } = useCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const [popular, setPopular] = useState<BxProduct[]>([])
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const router = useRouter()
  const [qtyEdit, setQtyEdit] = useState<{ key: string; raw: string } | null>(null)

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [heldOpen, setHeldOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdLabel, setHoldLabel] = useState("")
  const [holding, setHolding] = useState(false)
  const [resumeTarget, setResumeTarget] = useState<HeldCart | null>(null)
  const [resuming, setResuming] = useState(false)

  const loadHeld = useCallback(() => {
    getHeldCarts().then(setHeldCarts)
  }, [])

  useEffect(() => {
    loadHeld()
  }, [loadHeld])

  useEffect(() => {
    if (items.length === 0) {
      getProducts({ limit: 8 }).then(({ data }) => setPopular(data))
    }
  }, [items.length])

  function addPopular(p: BxProduct) {
    const inCartQty = items
      .filter((i) => i.product.id === p.id)
      .reduce((sum, i) => sum + i.qty, 0)
    if (inCartQty >= p.stock) return
    addItem(p)
    popKeyRef.current += 1
    setPop({ id: p.id, key: popKeyRef.current })
  }

  function commitQty(key: string) {
    if (!qtyEdit || qtyEdit.key !== key) return
    const n = parseInt(qtyEdit.raw, 10)
    updateQty(key, Number.isNaN(n) ? 1 : n)
    setQtyEdit(null)
  }

  function handleClear() {
    clearCart()
    setConfirmClear(false)
    toast.success("Keranjang dikosongkan")
  }

  async function handleHold() {
    if (items.length === 0) return
    setHolding(true)
    // Kalau label kosong, pakai nama pembeli terpilih; kalau tidak ada, "Pesanan N".
    const label = holdLabel.trim() || customer?.name || `Pesanan ${heldCarts.length + 1}`
    const id = await saveHeldCart(label, items, customer)
    setHolding(false)
    if (!id) {
      toast.error("Gagal menahan pesanan")
      return
    }
    setHoldOpen(false)
    setHoldLabel("")
    clearCart()
    loadHeld()
    toast.success(`Pesanan "${label}" ditahan`)
  }

  async function handleResume(h: HeldCart) {
    setHeldOpen(false)
    const held = await getHeldCart(h.id)
    if (!held || held.items.length === 0) {
      toast.error("Pesanan sudah tidak tersedia")
      loadHeld()
      return
    }
    // Kalau keranjang aktif masih berisi, minta konfirmasi dulu (akan diganti).
    if (items.length > 0) {
      setResumeTarget(h)
      return
    }
    replaceCart(held.items)
    setCustomer(held.customer)
    await deleteHeldCart(h.id)
    loadHeld()
    toast.success(`Pesanan "${h.label}" dilanjutkan`)
  }

  async function handleConfirmResume() {
    if (!resumeTarget) return
    setResuming(true)
    const held = await getHeldCart(resumeTarget.id)
    if (!held || held.items.length === 0) {
      toast.error("Pesanan sudah tidak tersedia")
      setResuming(false)
      setResumeTarget(null)
      loadHeld()
      return
    }
    replaceCart(held.items)
    setCustomer(held.customer)
    await deleteHeldCart(resumeTarget.id)
    setResuming(false)
    setResumeTarget(null)
    loadHeld()
    toast.success(`Pesanan "${resumeTarget.label}" dilanjutkan`)
  }

  async function handleDeleteHeld(h: HeldCart) {
    await deleteHeldCart(h.id)
    loadHeld()
    toast.success("Pesanan ditahan dihapus")
  }

  return (
    <div className="flex h-full flex-col">
      {heldCarts.length > 0 && (
        <div className="p-4 pb-0">
          <button
            type="button"
            onClick={() => setHeldOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-hairline bg-canvas p-3 text-left transition-colors active:bg-canvas-soft"
          >
            <Package className="size-4 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Pesanan Ditahan</p>
              <p className="text-xs text-ink-faint">{heldCarts.length} pesanan menunggu dilanjutkan</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between p-4 pb-2">
          <span className="text-ink-muted text-sm">{count} item</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHoldOpen(true)}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-canvas-soft"
            >
              Tahan
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive hover:bg-canvas-soft"
            >
              <Trash className="size-4" />
              Hapus Semua
            </button>
          </div>
        </div>
      )}

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
                  discount={resolveDiscountAmount(p.id, p.price_sell, discounts)}
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
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-4">
            {(() => {
              const order: string[] = []
              const map = new Map<string, CartItem[]>()
              for (const item of items) {
                const cat = item.product.categories?.name ?? ""
                if (!map.has(cat)) {
                  map.set(cat, [])
                  order.push(cat)
                }
                ;(map.get(cat) as CartItem[]).push(item)
              }
              return order.map((cat) => ({
                cat,
                group: map.get(cat) as CartItem[],
              }))
            })().map(({ cat, group }) => (
              <div key={cat || "__none__"} className="space-y-1">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {cat || "Tanpa Kategori"}
                </p>
                {group.map((item) => {
                  const { product, qty } = item
                  const key = cartKey(item)
                  const price = priceOf(item)
                  const maxQty = maxQtyFor(item)
                  const atMax = qty >= maxQty
                  return (
                    <div
                      key={key}
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
                        {item.variant && (
                          <p className="text-xs text-ink-muted mt-0.5">Varian: {item.variant.name}</p>
                        )}
                        {item.unit && (
                          <p className="text-xs text-ink-muted mt-0.5">
                            {item.unit.name} (= {item.unit.factor} {product.unit || "pcs"})
                          </p>
                        )}
                        <p className="text-xs text-primary mt-0.5 font-medium">
                          Rp{price.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => updateQty(key, qty - 1)}
                            className="flex size-7 items-center justify-center rounded-md border border-hairline text-ink-muted active:bg-canvas-soft"
                            aria-label="Kurangi"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          {qtyEdit?.key === key ? (
                            <Input
                              autoFocus
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={maxQty}
                              value={qtyEdit.raw}
                              onChange={(e) => setQtyEdit({ key, raw: e.target.value })}
                              onBlur={() => commitQty(key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitQty(key)
                                else if (e.key === "Escape") setQtyEdit(null)
                              }}
                              className="h-7 w-12 rounded-md px-1 text-center text-sm font-semibold"
                            />
                          ) : (
                            <button
                              onClick={() => setQtyEdit({ key, raw: String(qty) })}
                              className="w-7 text-center text-sm font-semibold text-ink active:text-primary"
                              aria-label="Ubah jumlah"
                            >
                              {qty}
                            </button>
                          )}
                          <button
                            onClick={() => updateQty(key, qty + 1)}
                            disabled={atMax}
                            className="flex size-7 items-center justify-center rounded-md border border-hairline text-ink-muted active:bg-canvas-soft disabled:opacity-40"
                            aria-label="Tambah"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        {maxQty < Number.MAX_SAFE_INTEGER && (
                          <p
                            className={
                              atMax
                                ? "mt-1 text-[10px] font-medium text-accent-orange"
                                : "mt-1 text-[10px] text-ink-faint"
                            }
                          >
                            {atMax ? `Stok dibatasi (tersisa ${maxQty})` : `Sisa stok ${maxQty}`}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          onClick={() => removeItem(key)}
                          className="rounded-md p-1 text-ink-muted active:bg-canvas-soft"
                          aria-label="Hapus"
                        >
                          <Trash className="size-4" />
                        </button>
                        <div className="text-right">
                          {(() => {
                            const disc = resolveDiscountAmount(product.id, price, discounts) * qty
                            const subtotal = price * qty
                            return disc > 0 ? (
                              <>
                                <p className="text-xs text-ink-faint line-through">
                                  Rp{subtotal.toLocaleString()}
                                </p>
                                <p className="text-sm font-semibold text-primary">
                                  Rp{(subtotal - disc).toLocaleString()}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm font-semibold text-ink">
                                Rp{subtotal.toLocaleString()}
                              </p>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
            <div className="flex items-end justify-between px-1">
              <span className="text-ink-muted text-sm pb-1">Total ({count} item)</span>
              <span className="text-2xl font-bold tracking-tight text-ink">
                Rp{netTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => router.push("/cashier")}
                className="h-12 shrink-0 rounded-full px-4 text-sm text-ink-muted"
              >
                Belanja Lagi
              </Button>
              <Button
                onClick={() => router.push("/checkout")}
                className="flex-1 rounded-full h-12 text-base"
              >
                Lanjut ke Pembayaran
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Daftar pesanan ditahan */}
      <Dialog open={heldOpen} onOpenChange={(o) => !o && setHeldOpen(false)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Pesanan Ditahan</DialogTitle>
            <DialogDescription>
              Pilih pesanan untuk dilanjutkan atau hapus.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {heldCarts.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{h.label}</p>
                  <p className="text-xs text-ink-faint">
                    {h.item_count} barang · {heldDateFmt.format(new Date(h.created_at))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResume(h)}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:bg-primary-active"
                >
                  Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHeld(h)}
                  aria-label={`Hapus ${h.label}`}
                  className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeldOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog menahan keranjang aktif */}
      <Dialog open={holdOpen} onOpenChange={(o) => !o && !holding && setHoldOpen(false)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tahan Pesanan</DialogTitle>
            <DialogDescription>
              Keranjang ({count} item) disimpan dan bisa dilanjutkan nanti.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={holdLabel}
            onChange={(e) => setHoldLabel(e.target.value)}
            placeholder="Nama pembeli / catatan (opsional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)} disabled={holding}>
              Batal
            </Button>
            <Button onClick={handleHold} disabled={holding}>
              {holding ? "Menyimpan..." : "Tahan & Mulai Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi melanjutkan saat keranjang masih berisi */}
      <Dialog open={resumeTarget !== null} onOpenChange={(o) => !o && !resuming && setResumeTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Lanjutkan Pesanan?</DialogTitle>
            <DialogDescription>
              Isi keranjang saat ini akan diganti dengan pesanan &quot;{resumeTarget?.label}&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeTarget(null)} disabled={resuming}>
              Batal
            </Button>
            <Button onClick={handleConfirmResume} disabled={resuming}>
              {resuming ? "Meneruskan..." : "Lanjutkan"}
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
