import { describe, expect, it } from "vitest"
import {
  cartKey,
  computeRedeem,
  computeTotals,
  maxQtyFor,
  priceOf,
} from "@/lib/pricing"
import type { BxProduct, BxProductUnit, BxVariant } from "@/components/products/types"

function product(over: Partial<BxProduct> = {}): BxProduct {
  return {
    id: "p1",
    name: "Indomie Goreng",
    category_id: null,
    price_buy: 2000,
    price_sell: 3000,
    stock: 100,
    min_stock: 5,
    is_favorite: false,
    unit: "pcs",
    sku: null,
    barcode: null,
    image_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    categories: null,
    ...over,
  }
}

const dus: BxProductUnit = { id: "u1", product_id: "p1", name: "Dus", factor: 12, price_sell: 30000 }
const varM: BxVariant = { id: "v1", product_id: "p1", name: "M", sku: null, price_buy: 2200, price_sell: 3200 }

describe("cartKey", () => {
  it("memisahkan varian berbeda pada produk sama", () => {
    const a = { product: product(), variant: varM }
    const b = { product: product(), variant: { ...varM, id: "v2" } }
    expect(cartKey(a)).not.toBe(cartKey(b))
  })

  it("memisahkan satuan berbeda pada produk+varian sama", () => {
    const a = { product: product(), unit: dus }
    const b = { product: product() }
    expect(cartKey(a)).not.toBe(cartKey(b))
  })
})

describe("priceOf", () => {
  it("prioritas satuan > varian > harga produk", () => {
    expect(priceOf({ product: product(), unit: dus })).toBe(30000)
    expect(priceOf({ product: product(), variant: varM })).toBe(3200)
    expect(priceOf({ product: product() })).toBe(3000)
    expect(priceOf({ product: product(), unit: dus, variant: varM })).toBe(30000)
  })
})

describe("maxQtyFor", () => {
  it("membatasi kuantitas oleh stok dibagi faktor", () => {
    expect(maxQtyFor({ product: product({ stock: 25 }), unit: dus })).toBe(2)
    expect(maxQtyFor({ product: product({ stock: 24 }), unit: dus })).toBe(2)
    expect(maxQtyFor({ product: product({ stock: 24 }) })).toBe(24)
    expect(maxQtyFor({ product: product({ stock: 0 }) })).toBe(0)
  })
})

describe("computeRedeem", () => {
  const base = {
    loyaltyEnabled: true,
    pointsRequested: 500,
    customerPoints: 1000,
    redeemValue: 100,
    remainingAfterNotaDisc: 50000,
  }

  it("dibatasi saldo", () => {
    const r = computeRedeem({ ...base, customerPoints: 100 })
    expect(r.redeemMax).toBe(100)
    expect(r.pointsValue).toBe(10000)
  })

  it("dibatasi jumlah yang diminta", () => {
    const r = computeRedeem({ ...base, pointsRequested: 40 })
    expect(r.redeemMax).toBe(40)
  })

  it("dibatasi sisa tagihan agar total tidak negatif", () => {
    const r = computeRedeem({ ...base, remainingAfterNotaDisc: 5000 })
    expect(r.redeemMax).toBe(50)
    expect(r.pointsValue).toBe(5000)
  })

  it("nol saat loyalitas nonaktif, tanpa poin, atau nilai tukar 0", () => {
    expect(computeRedeem({ ...base, loyaltyEnabled: false })).toEqual({ redeemMax: 0, pointsValue: 0 })
    expect(computeRedeem({ ...base, customerPoints: 0 })).toEqual({ redeemMax: 0, pointsValue: 0 })
    expect(computeRedeem({ ...base, pointsRequested: 0 })).toEqual({ redeemMax: 0, pointsValue: 0 })
    expect(computeRedeem({ ...base, redeemValue: 0 })).toEqual({ redeemMax: 0, pointsValue: 0 })
  })
})

describe("computeTotals", () => {
  const base = { netBeforeNota: 42000, discountAmount: 2000, pointsValue: 0, feeType: "rp" as const, feeInput: 2000 }

  it("biaya rupiah ditambahkan ke total", () => {
    const t = computeTotals(base)
    expect(t.feeBase).toBe(40000)
    expect(t.feeAmount).toBe(2000)
    expect(t.netTotal).toBe(42000)
  })

  it("biaya persen dihitung dari total SETELAH diskon & poin", () => {
    const t = computeTotals({ ...base, feeType: "pct", feeInput: 10 })
    expect(t.feeBase).toBe(40000)
    expect(t.feeAmount).toBe(4000)
    expect(t.netTotal).toBe(44000)
  })

  it("potongan poin mengurangi dasar biaya", () => {
    const t = computeTotals({ ...base, pointsValue: 10000, feeType: "pct", feeInput: 5 })
    expect(t.feeBase).toBe(30000)
    expect(t.feeAmount).toBe(1500)
    expect(t.netTotal).toBe(31500)
  })

  it("potongan melebihi tagihan tidak membuat total negatif", () => {
    const t = computeTotals({ ...base, discountAmount: 60000, pointsValue: 10000, feeType: "pct", feeInput: 10 })
    expect(t.feeBase).toBe(0)
    expect(t.feeAmount).toBe(0)
    expect(t.netTotal).toBe(0)
  })

  it("biaya flat tetap dikenakan walau diskon melebihi tagihan", () => {
    const t = computeTotals({ ...base, discountAmount: 60000, pointsValue: 10000 })
    expect(t.feeBase).toBe(0)
    expect(t.feeAmount).toBe(2000)
    expect(t.netTotal).toBe(2000)
  })
})

// Smoke test alur pembayaran checkout: item → diskon nota → poin → biaya → total.
describe("smoke: checkout totals", () => {
  it("total akhir sesuai urutan perhitungan checkout", () => {
    const itemDiscTotal = 3000
    const total = 45000
    const netBeforeNota = Math.max(0, total - itemDiscTotal)
    const discountAmount = Math.round((netBeforeNota * 10) / 100)
    const redeem = computeRedeem({
      loyaltyEnabled: true,
      pointsRequested: 100,
      customerPoints: 100,
      redeemValue: 100,
      remainingAfterNotaDisc: netBeforeNota - discountAmount,
    })
    const totals = computeTotals({
      netBeforeNota,
      discountAmount,
      pointsValue: redeem.pointsValue,
      feeType: "pct",
      feeInput: 5,
    })

    expect(netBeforeNota).toBe(42000)
    expect(discountAmount).toBe(4200)
    expect(redeem.pointsValue).toBe(10000)
    expect(totals.feeAmount).toBe(1390)
    expect(totals.netTotal).toBe(29190)
  })
})
