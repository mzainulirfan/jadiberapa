import type { StoreBackupBundle } from "@/lib/backup/types"

export function normalizeBackupBundle(bundle: StoreBackupBundle): StoreBackupBundle {
  return {
    ...bundle,
    product_units: bundle.product_units ?? [],
    suppliers: bundle.suppliers ?? [],
    purchases: bundle.purchases ?? [],
    purchase_items: bundle.purchase_items ?? [],
    supplier_payments: bundle.supplier_payments ?? [],
    loyalty_ledger: bundle.loyalty_ledger ?? [],
    // Backup sebelum fitur satuan tidak memiliki factor. Nilai historisnya
    // selalu satuan dasar, sehingga fallback yang benar adalah 1.
    transaction_items: (bundle.transaction_items ?? []).map((row) => ({
      factor: 1,
      ...row,
    })),
  }
}
