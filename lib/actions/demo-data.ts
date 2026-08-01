"use server"

import { createClient } from "@/lib/supabase/server"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

type ProductRow = {
  id: string
  store_id: string
  name: string
  category_id: string | null
  price_buy: number
  price_sell: number
  stock: number
  min_stock: number
  is_favorite: boolean
  unit: string
  sku: string | null
  barcode: string | null
}

type SeedResult = {
  categories: number
  products: number
  transactions: number
}

type DemoDataResult = {
  error: string | null
  counts: SeedResult | null
}

function chunk<T>(items: T[], size = 200) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function makeBarcode(index: number) {
  return `899${String(index).padStart(10, "0")}`.slice(0, 13)
}

async function clearStore(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string) {
  const tables = [
    "transaction_items",
    "payments",
    "stock_movements",
    "discount_products",
    "transactions",
    "product_variants",
    "discounts",
    "expenses",
    "products",
    "customers",
    "categories",
    "cash_sessions",
    "held_carts",
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("store_id", storeId)
    if (error) return error.message
  }
  return null
}

export async function generateDemoData(): Promise<DemoDataResult> {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa generate data", counts: null }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const cashierName = user?.email?.split("@")[0]
    ? user!.email!.split("@")[0].replace(/\./g, " ")
    : "Demo"

  const { data: storeId } = await supabase.rpc("current_store_id")
  if (!storeId) return { error: "Toko aktif tidak ditemukan", counts: null }

  const clearError = await clearStore(supabase, String(storeId))
  if (clearError) return { error: clearError, counts: null }

  const categoryRows = Array.from({ length: 200 }, (_, i) => ({
    id: crypto.randomUUID(),
    store_id: String(storeId),
    name: `Kategori ${String(i + 1).padStart(3, "0")}`,
  }))

  const units = ["pcs", "box", "pack", "botol", "bungkus", "kg", "liter"]
  const productRows: ProductRow[] = []
  for (let i = 0; i < 1000; i++) {
    const priceBuy = randInt(1_000, 80_000)
    const priceSell = priceBuy + randInt(500, 35_000)
    productRows.push({
      id: crypto.randomUUID(),
      store_id: String(storeId),
      name: `Produk ${String(i + 1).padStart(4, "0")}`,
      category_id: pick(categoryRows).id,
      price_buy: priceBuy,
      price_sell: priceSell,
      stock: randInt(180, 600),
      min_stock: randInt(5, 25),
      is_favorite: Math.random() < 0.08,
      unit: pick(units),
      sku: `PRD-${String(i + 1).padStart(4, "0")}`,
      barcode: Math.random() < 0.12 ? makeBarcode(i + 1) : null,
    })
  }

  const stockByProduct = new Map(productRows.map((p) => [p.id, p.stock]))
  const saleMethods = ["cash", "cash", "cash", "qris", "dana", "utang"] as const
  const transactionRows: Record<string, unknown>[] = []
  const itemRows: Record<string, unknown>[] = []
  const paymentRows: Record<string, unknown>[] = []
  const movementRows: Record<string, unknown>[] = []

  for (let i = 0; i < 2000; i++) {
    const transactionId = crypto.randomUUID()
    const availableProducts = productRows.filter((product) => (stockByProduct.get(product.id) ?? 0) > 0)
    if (availableProducts.length === 0) break

    const product = pick(availableProducts)
    const qty = randInt(1, 4)
    const currentStock = stockByProduct.get(product.id) ?? 0
    const safeQty = Math.max(1, Math.min(qty, currentStock))
    const gross = product.price_sell * safeQty
    const discount = Math.random() < 0.15 ? randInt(0, Math.max(1, Math.floor(gross * 0.08))) : 0
    const method = pick(saleMethods)
    const fee = Math.random() < 0.1 ? randInt(0, Math.max(1, Math.floor(gross * 0.03))) : 0
    const total = Math.max(0, gross - discount + fee)
    const isUtang = method === "utang"
    const paid = isUtang ? randInt(0, Math.max(1, Math.floor(total * 0.7))) : total

    transactionRows.push({
      id: transactionId,
      store_id: String(storeId),
      total,
      discount,
      fee,
      payment_method: method,
      customer_id: null,
      paid_amount: paid,
      status: paid >= total ? "lunas" : "utang",
      user_id: user?.id ?? null,
      cashier_name: cashierName,
      number: transactionId.slice(0, 8).toUpperCase(),
      share_token: crypto.randomUUID(),
      created_at: new Date(Date.now() - randInt(0, 1000 * 60 * 60 * 24 * 60)).toISOString(),
    })

    const createdAt = transactionRows[transactionRows.length - 1].created_at as string

    itemRows.push({
      id: crypto.randomUUID(),
      store_id: String(storeId),
      transaction_id: transactionId,
      product_id: product.id,
      qty: safeQty,
      price_sell: product.price_sell,
      subtotal: gross,
      discount,
      variant_id: null,
      variant_name: null,
      price_buy: product.price_buy,
      created_at: createdAt,
    })

    if (isUtang && paid > 0) {
      paymentRows.push({
        id: crypto.randomUUID(),
        store_id: String(storeId),
        transaction_id: transactionId,
        amount: paid,
        method: "cash",
        note: "DP demo",
        created_at: createdAt,
      })
    }

    movementRows.push({
      id: crypto.randomUUID(),
      store_id: String(storeId),
      product_id: product.id,
      type: "out",
      qty: -safeQty,
      note: "Penjualan demo",
      created_at: createdAt,
    })

    stockByProduct.set(product.id, Math.max(0, currentStock - safeQty))
  }

  const finalProductRows = productRows.map((p) => ({
    ...p,
    stock: stockByProduct.get(p.id) ?? p.stock,
  }))

  const insertSteps: Array<[string, Record<string, unknown>[]]> = [
    ["categories", categoryRows],
    ["products", finalProductRows],
    ["transactions", transactionRows],
    ["transaction_items", itemRows],
    ["payments", paymentRows],
    ["stock_movements", movementRows],
  ]

  for (const [table, rows] of insertSteps) {
    for (const part of chunk(rows)) {
      const { error } = await supabase.from(table).insert(part)
      if (error) return { error: `Gagal mengisi ${table}: ${error.message}`, counts: null }
    }
  }

  for (const path of ["/dashboard", "/products", "/categories", "/transactions", "/reports", "/expenses", "/cashier", "/debts", "/shift", "/more", "/backup"]) {
    revalidatePath(path)
  }

  return {
    error: null,
    counts: {
      categories: categoryRows.length,
      products: finalProductRows.length,
      transactions: transactionRows.length,
    },
  }
}
