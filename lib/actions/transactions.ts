"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isRetryableDatabaseError } from "@/lib/transactions/errors"
import { normalizeTransactionItems } from "@/lib/transactions/input"

export type CreateTransactionResult = {
  error: string | null
  id?: string | null
  duplicate?: boolean
  errorCode?: string | null
  retryable?: boolean
}

function pgInteger(value: number | undefined, fallback = 0) {
  const rounded = Math.round(value ?? fallback)
  return Number.isSafeInteger(rounded) && rounded >= 0 && rounded <= 2147483647
    ? rounded
    : null
}

// Server Action ini sengaja tipis. Harga, stok, total, dan loyalty dihitung di
// RPC database agar satu request tidak bisa menghasilkan data setengah jadi.
export async function createTransaction(
  items: unknown,
  payment_method: string = "cash",
  customer_id?: string | null,
  paid_amount?: number,
  discount?: number,
  fee?: number,
  points_redeemed?: number,
  idempotencyKey?: string
): Promise<CreateTransactionResult> {
  const supabase = await createClient()
  const normalized = normalizeTransactionItems(items)
  if ("error" in normalized) {
    return { error: normalized.error, errorCode: "INVALID_INPUT", retryable: false }
  }
  const key = idempotencyKey?.trim() || randomUUID()
  if (key.length > 128) {
    return { error: "Kunci transaksi tidak valid", errorCode: "INVALID_INPUT", retryable: false }
  }
  const paid = paid_amount == null ? null : pgInteger(paid_amount)
  const noteDiscount = pgInteger(discount)
  const serviceFee = pgInteger(fee)
  const points = pgInteger(points_redeemed)
  if (
    (paid_amount != null && paid == null) ||
    noteDiscount == null ||
    serviceFee == null ||
    points == null
  ) {
    return { error: "Nominal transaksi tidak valid", errorCode: "INVALID_INPUT", retryable: false }
  }

  const { data, error } = await supabase.rpc("create_transaction", {
    p_items: normalized.items.map((item) => ({
      product_id: item.product_id,
      qty: Math.round(item.qty),
      unit_id: item.unit_id || null,
      unit_name: item.unit_name || null,
      variant_id: item.variant_id || null,
      discount: Math.max(0, Math.round(item.discount ?? 0)),
      discount_mode: item.discount_mode,
    })),
    p_payment_method: payment_method,
    p_customer_id: customer_id || null,
    p_paid_amount: paid,
    p_discount: noteDiscount,
    p_fee: serviceFee,
    p_points_redeemed: points,
    p_idempotency_key: key,
  })

  if (error) {
    return {
      error: error.message,
      errorCode: error.code ?? "DATABASE_ERROR",
      retryable: isRetryableDatabaseError(error),
    }
  }
  const result = (data ?? {}) as {
    error?: string | null
    error_code?: string | null
    retryable?: boolean
    id?: string | null
    duplicate?: boolean
  }
  if (result.error) {
    return {
      error: result.error,
      errorCode: result.error_code ?? "TRANSACTION_REJECTED",
      retryable: result.retryable === true,
    }
  }
  if (!result.id) {
    return { error: "Gagal membuat transaksi", errorCode: "INVALID_RESPONSE", retryable: true }
  }

  revalidatePath("/cashier")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  revalidatePath("/debts")
  revalidatePath("/customers")
  return { error: null, id: result.id, duplicate: result.duplicate === true }
}

// Mencatat pembayaran (cicilan/pelunasan) dengan row lock di database.
export async function recordPayment(
  transactionId: string,
  amount: number,
  method: string = "cash",
  note?: string
) {
  const supabase = await createClient()
  const amt = Math.round(amount)
  if (!Number.isSafeInteger(amt) || amt <= 0 || amt > 2147483647) {
    return { error: "Nominal tidak valid" }
  }

  const { data, error } = await supabase.rpc("record_payment", {
    p_transaction_id: transactionId,
    p_amount: amt,
    p_method: method,
    p_note: note || null,
  })
  if (error) return { error: error.message }

  const result = (data ?? {}) as {
    error?: string | null
    paid_amount?: number
    status?: string
  }
  if (result.error) return { error: result.error }

  revalidatePath("/debts")
  revalidatePath(`/transactions/${transactionId}`)
  return { error: null, paid_amount: result.paid_amount, status: result.status }
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
