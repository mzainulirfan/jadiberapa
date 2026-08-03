"use client"

import { createClient } from "@/lib/supabase/client"
import type { CartItem, BxCartCustomer } from "@/components/cart/cart-provider"

const supabase = createClient()

// store_id aktif dari RPC (RLS-aman). null jika tidak ada toko aktif.
export async function currentStoreId(): Promise<string | null> {
  const { data } = await supabase.rpc("current_store_id")
  return (data as string | null) ?? null
}

export type CartSnapshot = {
  items: CartItem[]
  updatedAt: string
  customer: BxCartCustomer | null
}

export async function getCart(): Promise<CartSnapshot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const storeId = await currentStoreId()
  const { data, error } = await supabase
    .from("carts")
    .select("items, updated_at, customer, store_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error || !data) return null
  // Isolasi: hanya tampilkan baris yang dimiliki toko aktif. Baris legacy tanpa
  // store_id (belum pernah ditulis dengan tag toko) diperlakukan sebagai milik
  // toko aktif agar keranjang tidak "hilang" saat tab dibuka kembali.
  const rowStore = (data.store_id ?? null) as string | null
  if (rowStore && storeId && rowStore !== storeId) return null
  return {
    items: (data.items ?? []) as CartItem[],
    updatedAt: (data.updated_at ?? "") as string,
    customer: (data.customer ?? null) as BxCartCustomer | null,
  }
}

// Mengembalikan updated_at yang ditulis agar pemanggil bisa mengurutkan echo
// realtime secara monotonik (menghindari echo lama menimpa state baru).
export async function saveCart(
  items: CartItem[],
  customer: BxCartCustomer | null
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const updatedAt = new Date().toISOString()
  const storeId = await currentStoreId()
  const payload: {
    user_id: string
    items: CartItem[]
    customer: BxCartCustomer | null
    updated_at: string
    store_id?: string
  } = { user_id: user.id, items, customer, updated_at: updatedAt }
  if (storeId) payload.store_id = storeId
  const { error } = await supabase
    .from("carts")
    .upsert(payload, { onConflict: "user_id" })
  return error ? null : updatedAt
}

export async function watchCart(
  onChange: (items: CartItem[], updatedAt: string, customer: BxCartCustomer | null) => void
): Promise<() => void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return () => {}
  const storeId = await currentStoreId()
  if (!storeId) return () => {}

  const channel = supabase
    .channel("cart-changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "carts",
        filter: `user_id=eq.${user.id} and store_id=eq.${storeId}`,
      },
      (payload) => {
        const row = payload.new as {
          items: CartItem[]
          updated_at: string
          customer: BxCartCustomer | null
        }
        onChange(row.items ?? [], row.updated_at ?? "", (row.customer ?? null))
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
