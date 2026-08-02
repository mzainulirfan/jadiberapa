"use server"

import { isOwner } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import type { StoreBackupBundle, BackupRow } from "@/lib/backup/types"

function chunk<T>(items: T[], size = 500) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

async function insertRows<T extends BackupRow>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  rows: T[],
  storeId: string
) {
  for (const part of chunk(rows)) {
    if (part.length === 0) continue
    const payload = part.map((row) => {
      const next = { ...row, store_id: storeId } as Record<string, unknown>
      if (table === "products") delete next.is_low_stock
      return next
    })
    const { error } = await supabase.from(table).insert(payload)
    if (error) return error.message
  }
  return null
}

async function clearStoreData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string
) {
  const tables = [
    "transaction_items",
    "payments",
    "stock_movements",
    "purchase_items",
    "supplier_payments",
    "purchases",
    "suppliers",
    "discount_products",
    "transactions",
    "product_variants",
    "discounts",
    "expenses",
    "products",
    "customers",
    "categories",
    "cash_sessions",
    "settings",
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("store_id", storeId)
    if (error) return error.message
  }
  return null
}

export async function restoreStoreBackup(bundle: StoreBackupBundle) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa memulihkan backup" }
  const supabase = await createClient()
  const { data: storeId } = await supabase.rpc("current_store_id")
  if (!storeId) return { error: "Toko aktif tidak ditemukan" }

  const clearError = await clearStoreData(supabase, String(storeId))
  if (clearError) return { error: clearError }

  const steps: Array<[string, BackupRow[]]> = [
    ["settings", bundle.settings],
    ["categories", bundle.categories],
    ["customers", bundle.customers],
    ["suppliers", bundle.suppliers],
    ["products", bundle.products],
    ["product_variants", bundle.product_variants],
    ["purchases", bundle.purchases],
    ["purchase_items", bundle.purchase_items],
    ["supplier_payments", bundle.supplier_payments],
    ["discounts", bundle.discounts],
    ["discount_products", bundle.discount_products],
    ["cash_sessions", bundle.cash_sessions],
    ["expenses", bundle.expenses],
    ["transactions", bundle.transactions],
    ["transaction_items", bundle.transaction_items],
    ["payments", bundle.payments],
    ["stock_movements", bundle.stock_movements],
  ]

  for (const [table, rows] of steps) {
    const err = await insertRows(supabase, table, rows, String(storeId))
    if (err) return { error: `Gagal memulihkan ${table}: ${err}` }
  }

  return { error: null }
}
