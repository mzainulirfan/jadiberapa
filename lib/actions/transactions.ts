"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createTransaction(
  items: { product_id: string; qty: number; price_sell: number; subtotal: number }[],
  payment_method: string = "cash"
) {
  const supabase = await createClient()
  const total = items.reduce((sum, i) => sum + i.subtotal, 0)

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({ total, payment_method })
    .select()
    .single()

  if (txError) return { error: txError.message }
  if (!transaction) return { error: "Gagal membuat transaksi" }

  const txItems = items.map((i) => ({ ...i, transaction_id: transaction.id }))
  const { error: itemError } = await supabase.from("transaction_items").insert(txItems)

  if (itemError) return { error: itemError.message }

  for (const item of items) {
    await supabase.rpc("decrement_stock", { pid: item.product_id, qty: item.qty })
  }

  revalidatePath("/cashier")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  return { error: null, id: transaction.id }
}

export async function getTransactions() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name, price_buy))")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, transactions: [] }
  return { error: null, transactions: data ?? [] }
}

export async function getTransaction(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name))")
    .eq("id", id)
    .single()

  if (error) return { error: error.message, transaction: null }
  return { error: null, transaction: data }
}
