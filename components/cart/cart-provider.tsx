"use client"

import * as React from "react"
import type { BxProduct } from "@/components/products/types"
import { getCart, saveCart, watchCart } from "@/lib/db/cart"

export type CartItem = {
  product: BxProduct
  qty: number
}

type CartContextValue = {
  items: CartItem[]
  addItem: (product: BxProduct) => void
  updateQty: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  total: number
  count: number
}

const CartContext = React.createContext<CartContextValue | null>(null)

// Signatur kanonik keranjang: hanya id produk + qty, urutan-independen.
// jsonb menyusun ulang urutan key, jadi JSON.stringify tidak andal untuk pembandingan.
function cartSig(items: CartItem[]) {
  return items.map((i) => `${i.product.id}:${i.qty}`).join("|")
}

// timestamptz bisa diserialkan beda format (offset/precision) antara yang kita
// kirim & echo realtime, jadi bandingkan sebagai epoch ms, bukan string.
function tsMs(s: string | null | undefined) {
  const n = s ? Date.parse(s) : NaN
  return Number.isNaN(n) ? 0 : n
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const hydratedRef = React.useRef(false)
  // updated_at (epoch ms) terakhir yang sudah kita terapkan/tulis. Echo realtime
  // yang tidak lebih baru dari ini diabaikan agar qty tidak "muter2".
  const lastTsRef = React.useRef(0)

  React.useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | null = null

    async function init() {
      const stored = await getCart()
      if (!mounted) return
      if (stored) {
        setItems(stored.items)
        lastTsRef.current = tsMs(stored.updatedAt)
      }
      hydratedRef.current = true
      unsubscribe = await watchCart((remoteItems, updatedAt) => {
        const ts = tsMs(updatedAt)
        // Abaikan echo yang tidak lebih baru dari state yang sudah kita
        // terapkan/tulis (termasuk echo tulisan sendiri & echo lama/redeliver).
        if (ts && ts <= lastTsRef.current) return
        if (ts) lastTsRef.current = ts
        const sig = cartSig(remoteItems)
        setItems((prev) => (cartSig(prev) === sig ? prev : remoteItems))
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
      saveCart(items).then((ts) => {
        const ms = tsMs(ts)
        if (ms > lastTsRef.current) lastTsRef.current = ms
      })
    }, 400)
    return () => clearTimeout(t)
  }, [items])

  const addItem = React.useCallback((product: BxProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: Math.min(i.qty + 1, i.product.stock) }
            : i
        )
      }
      return [...prev, { product, qty: 1 }]
    })
  }, [])

  const updateQty = React.useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) =>
            i.product.id === productId
              ? { ...i, qty: Math.min(qty, i.product.stock) }
              : i
          )
    )
  }, [])

  const removeItem = React.useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const clearCart = React.useCallback(() => {
    setItems([])
  }, [])

  const total = items.reduce((sum, i) => sum + i.product.price_sell * i.qty, 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  const value = React.useMemo(
    () => ({ items, addItem, updateQty, removeItem, clearCart, total, count }),
    [items, addItem, updateQty, removeItem, clearCart, total, count]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = React.useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
