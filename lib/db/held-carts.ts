"use client"

import { createClient } from "@/lib/supabase/client"
import type { CartItem, BxCartCustomer } from "@/components/cart/cart-provider"

const supabase = createClient()

export type HeldCart = {
  id: string
  label: string
  item_count: number
  created_at: string
  items: CartItem[]
}

export type HeldCartDetail = {
  items: CartItem[]
  customer: BxCartCustomer | null
}

// Daftar pesanan yang ditahan user di toko aktif (terbaru dulu).
export async function getHeldCarts(): Promise<HeldCart[]> {
  const { data } = await supabase
    .from("held_carts")
    .select("id, label, items, created_at")
    .order("created_at", { ascending: false })
  return ((data ?? []) as { id: string; label: string; items: CartItem[]; created_at: string }[]).map(
    (r) => ({
      id: r.id,
      label: r.label,
      item_count: r.items.length,
      created_at: r.created_at,
      items: r.items,
    })
  )
}

// Muat isi satu pesanan ditahan untuk dilanjutkan (barang + pembeli).
export async function getHeldCart(id: string): Promise<HeldCartDetail | null> {
  const { data } = await supabase.from("held_carts").select("items, customer").eq("id", id).maybeSingle()
  if (!data) return null
  return {
    items: (data.items ?? []) as CartItem[],
    customer: (data.customer ?? null) as BxCartCustomer | null,
  }
}

// Simpan keranjang aktif sebagai pesanan ditahan. Mengembalikan id, atau null.
export async function saveHeldCart(
  label: string,
  items: CartItem[],
  customer: BxCartCustomer | null
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("held_carts")
    .insert({ user_id: user.id, label, items, customer })
    .select("id")
    .single()
  if (error) return null
  return (data?.id as string) ?? null
}

export async function deleteHeldCart(id: string): Promise<boolean> {
  const { error } = await supabase.from("held_carts").delete().eq("id", id)
  return !error
}
