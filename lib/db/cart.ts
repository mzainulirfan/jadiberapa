"use client"

import { createClient } from "@/lib/supabase/client"
import type { CartItem } from "@/components/cart/cart-provider"

const supabase = createClient()

export async function getCart(): Promise<CartItem[] | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error || !data) return null
  return (data.items ?? []) as CartItem[]
}

export async function saveCart(items: CartItem[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from("carts")
    .upsert(
      { user_id: user.id, items, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
}

export async function watchCart(onChange: (items: CartItem[]) => void): Promise<() => void> {
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
        onChange((payload.new as { items: CartItem[] }).items)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
