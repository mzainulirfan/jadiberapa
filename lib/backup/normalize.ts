import type { StoreBackupBundle } from "@/lib/backup/types"

export function normalizeBackupBundle(bundle: StoreBackupBundle): StoreBackupBundle {
  const restoreMarker = "__backup_restore__"
  return {
    ...bundle,
    product_units: bundle.product_units ?? [],
    suppliers: bundle.suppliers ?? [],
    purchases: bundle.purchases ?? [],
    purchase_items: bundle.purchase_items ?? [],
    supplier_payments: bundle.supplier_payments ?? [],
    loyalty_ledger: bundle.loyalty_ledger ?? [],
    transactions: (bundle.transactions ?? []).map((row) => {
      const actorName = typeof row.actor_name === "string" ? row.actor_name : ""
      return {
        ...row,
        actor_user_id: null,
        effective_user_id: null,
        delegation_id: null,
        actor_name: actorName.startsWith(restoreMarker)
          ? actorName
          : `${restoreMarker}${actorName}`,
        was_delegated: row.was_delegated === true || typeof row.delegation_id === "string",
      }
    }),
    // Backup sebelum fitur satuan tidak memiliki factor. Nilai historisnya
    // selalu satuan dasar, sehingga fallback yang benar adalah 1.
    transaction_items: (bundle.transaction_items ?? []).map((row) => ({
      factor: 1,
      ...row,
    })),
  }
}
