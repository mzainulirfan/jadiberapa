export type TransactionItemInput = {
  product_id: string
  qty: number
  unit_id?: string | null
  unit_name?: string | null
  discount?: number
  discount_mode?: "manual"
  variant_id?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function optionalUuid(value: unknown) {
  return value == null || value === "" || (typeof value === "string" && UUID_RE.test(value))
}

// Validasi awal menjaga Server Action tidak mengirim payload aneh ke RPC.
// Validasi otoritatif tetap berada di database karena action dapat dipanggil
// langsung tanpa melewati UI.
export function normalizeTransactionItems(input: unknown):
  | { items: TransactionItemInput[] }
  | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "Keranjang minimal 1 item" }
  }
  if (input.length > 500) return { error: "Jumlah item transaksi terlalu banyak" }

  const items: TransactionItemInput[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "Format item transaksi tidak valid" }
    const item = raw as Record<string, unknown>
    if (typeof item.product_id !== "string" || !UUID_RE.test(item.product_id)) {
      return { error: "ID barang tidak valid" }
    }
    if (!Number.isInteger(item.qty) || Number(item.qty) <= 0 || Number(item.qty) > 1000000) {
      return { error: "Jumlah barang tidak valid" }
    }
    if (!optionalUuid(item.variant_id) || !optionalUuid(item.unit_id)) {
      return { error: "ID varian atau satuan tidak valid" }
    }
    if (
      item.discount != null &&
      (!Number.isSafeInteger(Number(item.discount)) ||
        Number(item.discount) < 0 ||
        Number(item.discount) > 2147483647)
    ) {
      return { error: "Diskon item tidak valid" }
    }
    const unitName = typeof item.unit_name === "string" ? item.unit_name.trim() : ""
    if (unitName.length > 100) return { error: "Nama satuan terlalu panjang" }
    items.push({
      product_id: item.product_id,
      qty: item.qty as number,
      unit_id: typeof item.unit_id === "string" ? item.unit_id : null,
      unit_name: unitName || null,
      variant_id: typeof item.variant_id === "string" ? item.variant_id : null,
      discount: Math.round(Number(item.discount ?? 0)),
      ...(item.discount_mode === "manual" ? { discount_mode: "manual" as const } : {}),
    })
  }
  return { items }
}
