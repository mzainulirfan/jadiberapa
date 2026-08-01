"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getProducts, resolveDiscountAmount } from "@/lib/db/queries"
import { cartKey, priceOf, useCart } from "@/components/cart/cart-provider"
import { ProductCard } from "@/components/cashier/product-card"
import { Minus, Plus, Trash, Package } from "@/components/ui/icons"
import type { BxProduct } from "@/components/products/types"

export function CartView() {
  const { items, addItem, updateQty, removeItem, clearCart, netTotal, discounts, count } = useCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const [popular, setPopular] = useState<BxProduct[]>([])
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const router = useRouter()

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

  function handleClear() {
    clearCart()
    setConfirmClear(false)
    toast.success("Keranjang dikosongkan")
  }

  return (
    <div className="flex h-full flex-col">
      {items.length > 0 && (
        <div className="flex items-center justify-between p-4 pb-2">
          <span className="text-ink-muted text-sm">{count} item</span>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive hover:bg-canvas-soft"
          >
            <Trash className="size-4" />
            Hapus Semua
          </button>
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
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-1">
            {items.map((item) => {
              const { product, qty } = item
              const key = cartKey(item)
              const price = priceOf(item)
              const atMax = qty >= product.stock
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
                    <p className="text-xs text-ink-muted mt-0.5">
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
                      <span className="w-7 text-center text-sm font-semibold text-ink">{qty}</span>
                      <button
                        onClick={() => updateQty(key, qty + 1)}
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

          <div className="shrink-0 border-t border-hairline bg-canvas p-4 space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-ink-muted text-sm pb-1">Total ({count} item)</span>
              <span className="text-2xl font-bold tracking-tight text-ink">
                Rp{netTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/cashier")}
                className="w-36 rounded-full h-12 text-base shrink-0"
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
