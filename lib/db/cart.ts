"use client"

import { createClient } from "@/lib/supabase/client"
import type { CartItem } from "@/components/cart/cart-provider"

const supabase = createClient()

export type CartSnapshot = { items: CartItem[]; updatedAt: string }

export async function getCart(): Promise<CartSnapshot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("carts")
    .select("items, updated_at")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error || !data) return null
  return {
    items: (data.items ?? []) as CartItem[],
    updatedAt: (data.updated_at ?? "") as string,
  }
}

// Mengembalikan updated_at yang ditulis agar pemanggil bisa mengurutkan echo
// realtime secara monotonik (menghindari echo lama menimpa state baru).
export async function saveCart(items: CartItem[]): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from("carts")
    .upsert(
      { user_id: user.id, items, updated_at: updatedAt },
      { onConflict: "user_id" }
    )
  return error ? null : updatedAt
}

export async function watchCart(
  onChange: (items: CartItem[], updatedAt: string) => void
): Promise<() => void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return () => {}

  const channel = supabase
    .channel("cart-changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "carts",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const row = payload.new as { items: CartItem[]; updated_at: string }
        onChange(row.items ?? [], row.updated_at ?? "")
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
