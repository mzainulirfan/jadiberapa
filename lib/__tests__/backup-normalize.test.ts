import { describe, expect, it } from "vitest"
import { normalizeBackupBundle } from "@/lib/backup/normalize"
import type { StoreBackupBundle } from "@/lib/backup/types"

function backup(overrides: Partial<StoreBackupBundle> = {}): StoreBackupBundle {
  return {
    meta: { exported_at: "2026-08-10T00:00:00.000Z", app_version: "1", store_name: "Toko" },
    settings: [],
    categories: [],
    products: [],
    product_units: [],
    product_variants: [],
    customers: [],
    suppliers: [],
    purchases: [],
    purchase_items: [],
    supplier_payments: [],
    expenses: [],
    discounts: [],
    discount_products: [],
    cash_sessions: [],
    transactions: [],
    transaction_items: [],
    payments: [],
    stock_movements: [],
    loyalty_ledger: [],
    ...overrides,
  }
}

describe("normalizeBackupBundle", () => {
  it("mengisi tabel opsional dari backup versi lama", () => {
    const old = backup()
    Object.assign(old, {
      product_units: undefined,
      suppliers: undefined,
      purchases: undefined,
      purchase_items: undefined,
      supplier_payments: undefined,
      loyalty_ledger: undefined,
    })

    const normalized = normalizeBackupBundle(old)

    expect(normalized.product_units).toEqual([])
    expect(normalized.suppliers).toEqual([])
    expect(normalized.purchases).toEqual([])
    expect(normalized.purchase_items).toEqual([])
    expect(normalized.supplier_payments).toEqual([])
    expect(normalized.loyalty_ledger).toEqual([])
  })

  it("memberi factor 1 tanpa menimpa snapshot factor yang ada", () => {
    const normalized = normalizeBackupBundle(
      backup({
        transaction_items: [
          { id: "old" },
          { id: "dus", factor: 12, product_name: "Kopi" },
        ],
      })
    )

    expect(normalized.transaction_items).toEqual([
      { id: "old", factor: 1 },
      { id: "dus", factor: 12, product_name: "Kopi" },
    ])
  })
})
