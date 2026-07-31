"use client"

import * as React from "react"
import type { BxProduct } from "@/components/products/types"

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])

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
