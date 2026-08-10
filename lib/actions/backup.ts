"use server"

import { isOwner } from "@/lib/auth/roles"
import { normalizeBackupBundle } from "@/lib/backup/normalize"
import { createClient } from "@/lib/supabase/server"
import type { StoreBackupBundle } from "@/lib/backup/types"

const BACKUP_ARRAY_FIELDS = [
  "settings",
  "categories",
  "products",
  "product_units",
  "product_variants",
  "customers",
  "suppliers",
  "purchases",
  "purchase_items",
  "supplier_payments",
  "expenses",
  "discounts",
  "discount_products",
  "cash_sessions",
  "transactions",
  "transaction_items",
  "payments",
  "stock_movements",
  "loyalty_ledger",
] as const

const OPTIONAL_BACKUP_FIELDS = new Set<string>([
  "product_units",
  "suppliers",
  "purchases",
  "purchase_items",
  "supplier_payments",
  "loyalty_ledger",
])

function isValidBackup(value: unknown): value is StoreBackupBundle {
  if (!value || typeof value !== "object") return false
  const bundle = value as Record<string, unknown>
  if (!bundle.meta || typeof bundle.meta !== "object" || Array.isArray(bundle.meta)) return false
  const meta = bundle.meta as Record<string, unknown>
  if (
    typeof meta.exported_at !== "string" ||
    typeof meta.app_version !== "string" ||
    typeof meta.store_name !== "string"
  ) {
    return false
  }
  return BACKUP_ARRAY_FIELDS.every(
    (field) =>
      (OPTIONAL_BACKUP_FIELDS.has(field) || Array.isArray(bundle[field])) &&
      (bundle[field] == null ||
        (Array.isArray(bundle[field]) &&
          bundle[field].every((row) => row !== null && typeof row === "object")))
  )
}

export async function restoreStoreBackup(bundle: StoreBackupBundle) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa memulihkan backup" }
  if (!isValidBackup(bundle)) return { error: "Format backup tidak valid" }

  let serialized: string
  try {
    serialized = JSON.stringify(bundle)
  } catch {
    return { error: "Backup tidak bisa dibaca" }
  }
  if (new TextEncoder().encode(serialized).byteLength > 50 * 1024 * 1024) {
    return { error: "Ukuran backup maksimal 50 MB" }
  }

  const normalizedBundle = normalizeBackupBundle(bundle)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("restore_store_backup", {
    p_bundle: normalizedBundle,
  })
  if (error) return { error: error.message }
  const result = (data ?? {}) as { error?: string | null }
  if (result.error) return { error: result.error }

  return { error: null }
}
