"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createTransaction(
  items: { product_id: string; qty: number; price_sell: number; subtotal: number }[],
  payment_method: string = "cash",
  customer_id?: string | null,
  // Jumlah yang benar-benar dibayar saat checkout. Untuk metode "utang" ini bisa
  // 0 (murni utang) atau sebagian (DP). Undefined = dianggap lunas penuh.
  paid_amount?: number
) {
  const supabase = await createClient()
  const total = items.reduce((sum, i) => sum + i.subtotal, 0)

  const isUtang = payment_method === "utang"
  const paid = isUtang
    ? Math.max(0, Math.min(total, Math.round(paid_amount ?? 0)))
    : total
  const status = paid >= total ? "lunas" : "utang"

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      total,
      payment_method,
      customer_id: customer_id || null,
      paid_amount: paid,
      status,
    })
    .select()
    .single()

  if (txError) return { error: txError.message }
  if (!transaction) return { error: "Gagal membuat transaksi" }

  // Catat DP awal ke buku pembayaran agar riwayat pelunasan utang lengkap.
  if (isUtang && paid > 0) {
    await supabase
      .from("payments")
      .insert({ transaction_id: transaction.id, amount: paid, method: "cash", note: "DP" })
  }

  await supabase
    .from("transactions")
    .update({ number: transaction.id.slice(0, 8).toUpperCase() })
    .eq("id", transaction.id)

  // Snapshot harga beli (cost) per produk agar laba historis akurat & hitung laba
  // dashboard tak perlu join ke products.
  const productIds = [...new Set(items.map((i) => i.product_id))]
  const { data: costRows } = await supabase
    .from("products")
    .select("id, price_buy")
    .in("id", productIds)
  const costMap = new Map(
    (costRows ?? []).map((p) => [p.id as string, (p.price_buy as number) ?? 0])
  )

  const txItems = items.map((i) => ({
    ...i,
    transaction_id: transaction.id,
    price_buy: costMap.get(i.product_id) ?? 0,
  }))
  const { error: itemError } = await supabase.from("transaction_items").insert(txItems)

  if (itemError) return { error: itemError.message }

  for (const item of items) {
    await supabase.rpc("decrement_stock", { pid: item.product_id, qty: item.qty })
  }

  revalidatePath("/cashier")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  revalidatePath("/debts")
  return { error: null, id: transaction.id }
}

// Mencatat pembayaran (cicilan/pelunasan) untuk transaksi utang.
export async function recordPayment(
  transactionId: string,
  amount: number,
  method: string = "cash",
  note?: string
) {
  const supabase = await createClient()
  const amt = Math.round(amount)
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Nominal tidak valid" }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("total, paid_amount")
    .eq("id", transactionId)
    .single()

  if (txErr) return { error: txErr.message }
  if (!tx) return { error: "Transaksi tidak ditemukan" }

  const total = (tx.total as number) ?? 0
  const prevPaid = (tx.paid_amount as number) ?? 0
  const applied = Math.min(amt, Math.max(0, total - prevPaid))
  if (applied <= 0) return { error: "Utang sudah lunas" }

  const { error: payErr } = await supabase
    .from("payments")
    .insert({ transaction_id: transactionId, amount: applied, method, note: note || null })
  if (payErr) return { error: payErr.message }

  const newPaid = prevPaid + applied
  const status = newPaid >= total ? "lunas" : "utang"
  const { error: updErr } = await supabase
    .from("transactions")
    .update({ paid_amount: newPaid, status })
    .eq("id", transactionId)
  if (updErr) return { error: updErr.message }

  revalidatePath("/debts")
  revalidatePath(`/transactions/${transactionId}`)
  return { error: null, paid_amount: newPaid, status }
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

