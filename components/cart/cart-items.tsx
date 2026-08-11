"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { getProducts, resolveDiscountAmount } from "@/lib/db/queries"
import {
  cartKey,
  priceOf,
  maxQtyFor,
  useCart,
  type CartItem,
} from "@/components/cart/cart-provider"
import { ProductCard } from "@/components/cashier/product-card"
import { SwipeToDelete } from "@/components/cart/swipe-to-delete"
import { Minus, Plus, Trash, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { BxProduct } from "@/components/products/types"

// Daftar isi keranjang yang dipakai bersama: halaman /cart (swipe) dan panel
// keranjang desktop Kasir (tanpa gesture swipe). Semua kalkulasi & state tetap
// dari CartProvider; komponen ini murni penyajian.
export function CartItems({
  swipe = false,
  emptyAction,
}: {
  swipe?: boolean
  emptyAction?: React.ReactNode
}) {
  const { items, addItem, updateQty, removeItem, discounts } = useCart()
  const [popular, setPopular] = useState<BxProduct[]>([])
  const [qtyEdit, setQtyEdit] = useState<{ key: string; raw: string } | null>(null)
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)

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

  if (items.length === 0) {
    return (
      <div className="p-4 pt-0">
        <div className="py-8 text-center">
          <p className="text-sm text-ink-faint">Keranjang kosong</p>
          <p className="mt-1 text-xs text-ink-faint">
            Tambah dari barang populer di bawah atau dari Kasir
          </p>
        </div>
        <p className="mb-2 text-sm font-semibold text-ink-muted">Barang Populer</p>
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
          emptyAction ?? null
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pt-0">
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
            const row = (
              <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                  {item.variant && (
                    <p className="mt-0.5 text-xs text-ink-muted">Varian: {item.variant.name}</p>
                  )}
                  {item.unit && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {item.unit.name} (= {item.unit.factor} {product.unit || "pcs"})
                    </p>
                  )}
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    Rp{price.toLocaleString()}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
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
            return swipe ? (
              <SwipeToDelete
                key={key}
                onDelete={() => removeItem(key)}
                className="bg-canvas border border-hairline"
              >
                {row}
              </SwipeToDelete>
            ) : (
              <div key={key} className={cn("rounded-xl border border-hairline")}>
                {row}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}