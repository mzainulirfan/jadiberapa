import { describe, expect, it } from "vitest"
import { normalizeTransactionItems } from "@/lib/transactions/input"

const productId = "11111111-1111-4111-8111-111111111111"
const variantId = "22222222-2222-4222-8222-222222222222"

describe("normalizeTransactionItems", () => {
  it("menghapus field harga client dan mempertahankan identitas item", () => {
    const result = normalizeTransactionItems([
      {
        product_id: productId,
        qty: 2,
        price_sell: 1,
        subtotal: 1,
        variant_id: variantId,
        discount: 1500,
        discount_mode: "manual",
      },
    ])

    expect(result).toEqual({
      items: [
        {
          product_id: productId,
          qty: 2,
          unit_id: null,
          unit_name: null,
          variant_id: variantId,
          discount: 1500,
          discount_mode: "manual",
        },
      ],
    })
  })

  it("menolak qty tidak integer atau di luar batas", () => {
    expect(normalizeTransactionItems([{ product_id: productId, qty: 1.5 }])).toEqual({
      error: "Jumlah barang tidak valid",
    })
    expect(normalizeTransactionItems([{ product_id: productId, qty: 1000001 }])).toEqual({
      error: "Jumlah barang tidak valid",
    })
  })

  it("menolak ID relasi yang bukan UUID", () => {
    expect(
      normalizeTransactionItems([{ product_id: productId, qty: 1, unit_id: "not-a-uuid" }])
    ).toEqual({ error: "ID varian atau satuan tidak valid" })
  })

  it("menolak diskon negatif dan keranjang kosong", () => {
    expect(normalizeTransactionItems([])).toEqual({ error: "Keranjang minimal 1 item" })
    expect(normalizeTransactionItems([{ product_id: productId, qty: 1, discount: -1 }])).toEqual({
      error: "Diskon item tidak valid",
    })
  })

  it("merapikan nama satuan legacy", () => {
    expect(
      normalizeTransactionItems([{ product_id: productId, qty: 1, unit_name: "  Dus  " }])
    ).toMatchObject({ items: [{ unit_name: "Dus" }] })
  })

  it("menolak diskon di luar integer PostgreSQL", () => {
    expect(
      normalizeTransactionItems([{ product_id: productId, qty: 1, discount: 2147483648 }])
    ).toEqual({ error: "Diskon item tidak valid" })
  })
})
