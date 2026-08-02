import type { BxProduct, BxVariant, BxProductUnit } from "@/components/products/types"

// Item keranjang ringkas (struktural) untuk kalkulasi harga murni. Tidak boleh
// membawa efek samping/I-O supaya bisa di-unit-test tanpa Supabase.
export type PricedItem = {
  product: BxProduct
  variant?: BxVariant | null
  unit?: BxProductUnit | null
}

// Kunci identitas baris keranjang: produk + varian + satuan. Baris yang sama
// dalam satuan berbeda (mis. 1 dus vs 1 pcs) dihitung terpisah.
export function cartKey(i: PricedItem) {
  return `${i.product.id}::${i.variant?.id ?? ""}::${i.unit?.id ?? ""}`
}

// Harga efektif baris: harga satuan jika dipilih, lalu harga varian, lalu harga produk.
export function priceOf(i: PricedItem) {
  return i.unit?.price_sell ?? i.variant?.price_sell ?? i.product.price_sell
}

// Kapasitas maksimum baris dalam satuan terpilih, berdasar stok satuan dasar.
// Satuan dengan faktor n memakai n stok per item (1 dus = n pcs).
export function maxQtyFor(i: PricedItem) {
  const factor = Math.max(1, Math.round(i.unit?.factor ?? 1))
  return Math.floor(i.product.stock / factor)
}

// Klaim poin loyalitas: dibatasi saldo, jumlah yang diminta, dan sisa tagihan
// (agar total tidak negatif). Sumber kebenaran tunggal untuk checkout & server.
export type RedeemMath = { redeemMax: number; pointsValue: number }

export function computeRedeem(p: {
  loyaltyEnabled: boolean
  pointsRequested: number
  customerPoints: number
  redeemValue: number
  remainingAfterNotaDisc: number
}): RedeemMath {
  if (!p.loyaltyEnabled || p.pointsRequested <= 0 || p.customerPoints <= 0 || p.redeemValue <= 0) {
    return { redeemMax: 0, pointsValue: 0 }
  }
  const affordable = Math.floor(Math.max(0, p.remainingAfterNotaDisc) / p.redeemValue)
  const redeemMax = Math.max(
    0,
    Math.min(Math.round(p.pointsRequested), Math.floor(p.customerPoints), affordable)
  )
  return { redeemMax, pointsValue: redeemMax * p.redeemValue }
}

// Biaya layanan/pajak & total nota. Biaya persen dihitung dari total SETELAH
// diskon nota & poin (bukan sebelum diskon).
export type TotalsMath = { feeBase: number; feeAmount: number; netTotal: number }

export function computeTotals(p: {
  netBeforeNota: number
  discountAmount: number
  pointsValue: number
  feeType: "rp" | "pct"
  feeInput: number
}): TotalsMath {
  const feeBase = Math.max(0, p.netBeforeNota - p.discountAmount - p.pointsValue)
  const feeAmount =
    p.feeType === "pct"
      ? Math.round((feeBase * Math.min(p.feeInput, 100)) / 100)
      : Math.max(0, Math.round(p.feeInput))
  return { feeBase, feeAmount, netTotal: Math.max(0, feeBase + feeAmount) }
}
