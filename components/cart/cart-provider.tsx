"use client"

import * as React from "react"
import type { BxProduct, BxVariant, BxProductUnit } from "@/components/products/types"
import { cartKey, priceOf, maxQtyFor } from "@/lib/pricing"
import { getCart, saveCart, watchCart } from "@/lib/db/cart"
import {
  getDiscounts,
  invalidateDiscounts,
  resolveDiscountAmount,
  type BxDiscount,
} from "@/lib/db/queries"

export type CartItem = {
  product: BxProduct
  variant?: BxVariant
  unit?: BxProductUnit
  qty: number
}

export { cartKey, priceOf, maxQtyFor }

// Pembeli terpilih untuk transaksi yang sedang dibuat. Disimpan bersama keranjang
// agar tidak hilang saat kasir keluar-masuk halaman checkout. `points` hanya
// penanda awal dari daftar pembeli; saldo otoritatif dibaca ulang di server.
export type BxCartCustomer = { id: string | null; name: string; points?: number }

type CartContextValue = {
  items: CartItem[]
  customer: BxCartCustomer | null
  setCustomer: (c: BxCartCustomer | null) => void
  addItem: (product: BxProduct, variant?: BxVariant | null, unit?: BxProductUnit | null) => void
  updateQty: (key: string, qty: number) => void
  removeItem: (key: string) => void
  clearCart: () => void
  replaceCart: (items: CartItem[]) => void
  total: number
  netTotal: number
  count: number
  discounts: BxDiscount[]
  reloadDiscounts: () => void
}

const CartContext = React.createContext<CartContextValue | null>(null)

// Signatur kanonik keranjang: id produk + varian + satuan + qty, urutan-independen.
// jsonb menyusun ulang urutan key, jadi JSON.stringify tidak andal untuk pembandingan.
function cartSig(items: CartItem[]) {
  return items
    .map((i) => `${i.product.id}:${i.variant?.id ?? ""}:${i.unit?.id ?? ""}:${i.qty}`)
    .join("|")
}

// timestamptz bisa diserialkan beda format (offset/precision) antara yang kita
// kirim & echo realtime, jadi bandingkan sebagai epoch ms, bukan string.
function tsMs(s: string | null | undefined) {
  const n = s ? Date.parse(s) : NaN
  return Number.isNaN(n) ? 0 : n
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const [customer, setCustomer] = React.useState<BxCartCustomer | null>(null)
  const [discounts, setDiscounts] = React.useState<BxDiscount[]>([])
  const hydratedRef = React.useRef(false)
  // updated_at (epoch ms) terakhir yang sudah kita terapkan/tulis. Echo realtime
  // yang tidak lebih baru dari ini diabaikan agar qty tidak "muter2".
  const lastTsRef = React.useRef(0)

  // Aturan diskon aktif untuk auto-apply. Muat sekali saat mount; panggil
  // reloadDiscounts() dari halaman kelola diskon setelah mutasi.
  const loadDiscounts = React.useCallback(() => {
    getDiscounts().then(setDiscounts)
  }, [])

  const reloadDiscounts = React.useCallback(() => {
    invalidateDiscounts()
    getDiscounts().then(setDiscounts)
  }, [])

  React.useEffect(() => {
    loadDiscounts()
  }, [loadDiscounts])

  React.useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | null = null

    async function init() {
      const stored = await getCart()
      if (!mounted) return
      if (stored) {
        setItems(stored.items)
        setCustomer(stored.customer)
        lastTsRef.current = tsMs(stored.updatedAt)
      }
      hydratedRef.current = true
      unsubscribe = await watchCart((remoteItems, updatedAt, remoteCustomer) => {
        const ts = tsMs(updatedAt)
        // Abaikan echo yang tidak lebih baru dari state yang sudah kita
        // terapkan/tulis (termasuk echo tulisan sendiri & echo lama/redeliver).
        if (ts && ts <= lastTsRef.current) return
        if (ts) lastTsRef.current = ts
        const sig = cartSig(remoteItems)
        setItems((prev) => (cartSig(prev) === sig ? prev : remoteItems))
        setCustomer((prev) => {
          const same = prev?.id === remoteCustomer?.id
          return same ? prev : remoteCustomer
        })
      })
    }

    init()

    async function refetch() {
      if (document.visibilityState !== "visible") return
      const stored = await getCart()
      if (!mounted || !stored) return
      const ts = tsMs(stored.updatedAt)
      if (ts && ts <= lastTsRef.current) return
      if (ts) lastTsRef.current = ts
      setItems((prev) => (cartSig(prev) === cartSig(stored.items) ? prev : stored.items))
      setCustomer((prev) =>
        prev?.id === stored.customer?.id ? prev : stored.customer
      )
    }
    window.addEventListener("focus", refetch)
    document.addEventListener("visibilitychange", refetch)

    return () => {
      mounted = false
      unsubscribe?.()
      window.removeEventListener("focus", refetch)
      document.removeEventListener("visibilitychange", refetch)
    }
  }, [])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    const t = setTimeout(() => {
      saveCart(items, customer).then((ts) => {
        const ms = tsMs(ts)
        if (ms > lastTsRef.current) lastTsRef.current = ms
      })
    }, 400)
    return () => clearTimeout(t)
  }, [items, customer])

  const addItem = React.useCallback(
    (product: BxProduct, variant?: BxVariant | null, unit?: BxProductUnit | null) => {
      setItems((prev) => {
        const key = cartKey({ product, variant, unit })
        const existing = prev.find((i) => cartKey(i) === key)
        if (existing) {
          return prev.map((i) =>
            cartKey(i) === key ? { ...i, qty: Math.min(i.qty + 1, maxQtyFor(i)) } : i
          )
        }
        return [
          ...prev,
          { product, variant: variant || undefined, unit: unit || undefined, qty: 1 },
        ]
      })
    },
    []
  )

  const updateQty = React.useCallback((key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => cartKey(i) !== key)
        : prev.map((i) => (cartKey(i) === key ? { ...i, qty: Math.min(qty, maxQtyFor(i)) } : i))
    )
  }, [])

  const removeItem = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => cartKey(i) !== key))
  }, [])

  const clearCart = React.useCallback(() => {
    setItems([])
    setCustomer(null)
  }, [])

  // Ganti seluruh isi keranjang (dipakai untuk melanjutkan pesanan ditahan).
  const replaceCart = React.useCallback((next: CartItem[]) => {
    setItems(next)
  }, [])

  const total = items.reduce((sum, i) => sum + priceOf(i) * i.qty, 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  // Total NETO: harga jual (varian jika ada) dikurangi diskon otomatis per unit.
  const netTotal = React.useMemo(
    () =>
      items.reduce((sum, i) => {
        const price = priceOf(i)
        const unitDisc = resolveDiscountAmount(i.product.id, price, discounts)
        return sum + (price - unitDisc) * i.qty
      }, 0),
    [items, discounts]
  )

  const value = React.useMemo(
    () => ({ items, customer, setCustomer, addItem, updateQty, removeItem, clearCart, replaceCart, total, netTotal, count, discounts, reloadDiscounts }),
    [items, customer, setCustomer, addItem, updateQty, removeItem, clearCart, replaceCart, total, netTotal, count, discounts, reloadDiscounts]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = React.useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
