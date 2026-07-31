"use client"

import { createClient } from "@/lib/supabase/client"
import type { BxProduct, BxCategory } from "@/components/products/types"
import type { ProductSort } from "@/lib/actions/products"

const supabase = createClient()

const CATEGORY_TTL_MS = 60_000
let categoriesCache: BxCategory[] | null = null
let categoriesFetchedAt = 0
let categoriesPromise: Promise<BxCategory[]> | null = null

export function getCategories(): Promise<BxCategory[]> {
  const now = Date.now()
  if (categoriesCache && now - categoriesFetchedAt < CATEGORY_TTL_MS) {
    return Promise.resolve(categoriesCache)
  }
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      try {
        const { data } = await supabase.from("categories").select("id, name").order("name")
        categoriesCache = (data ?? []) as BxCategory[]
        categoriesFetchedAt = Date.now()
        return categoriesCache
      } finally {
        categoriesPromise = null
      }
    })()
  }
  return categoriesPromise
}

export function invalidateCategories() {
  categoriesCache = null
  categoriesFetchedAt = 0
}

export type BxCustomer = {
  id: string
  name: string
  phone: string | null
  address: string | null
}

export async function getCustomers(search?: string): Promise<BxCustomer[]> {
  let query = supabase.from("customers").select("id, name, phone, address").order("name")
  const s = search?.trim()
  if (s) query = query.ilike("name", `%${s}%`)
  const { data } = await query
  return (data ?? []) as unknown as BxCustomer[]
}

export type BxTransaction = {
  id: string
  number: string | null
  total: number
  payment_method: string
  customer_id: string | null
  created_at: string
  transaction_items: { id: string; qty: number }[]
  customers: { name: string } | null
}

export async function getTransactions(params: {
  search?: string
  dateFrom?: string | null
  page?: number
  pageSize?: number
}): Promise<{ data: BxTransaction[]; total: number }> {
  const { search, dateFrom, page = 0, pageSize = 20 } = params
  let query = supabase
    .from("transactions")
    .select(
      "id, number, total, payment_method, customer_id, created_at, transaction_items(id, qty), customers(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })

  const s = search?.trim()
  if (s) query = query.or(`number.ilike.%${s}%,customers.name.ilike.%${s}%`)
  if (dateFrom) query = query.gte("created_at", dateFrom)

  query = query.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, count } = await query
  return { data: (data ?? []) as unknown as BxTransaction[], total: count ?? 0 }
}

export async function getTransactionsSummary(params: {
  search?: string
  dateFrom?: string | null
}): Promise<{ count: number; total: number }> {
  const { search, dateFrom } = params
  let query = supabase.from("transactions").select("total")
  const s = search?.trim()
  if (s) query = query.or(`number.ilike.%${s}%,customers.name.ilike.%${s}%`)
  if (dateFrom) query = query.gte("created_at", dateFrom)
  const { data } = await query
  const rows = (data ?? []) as { total: number }[]
  return { count: rows.length, total: rows.reduce((sum, r) => sum + (r.total ?? 0), 0) }
}

export async function getProducts(params: {
  search?: string
  categoryIds?: string[]
  limit?: number
  sort?: ProductSort
  page?: number
  pageSize?: number
}): Promise<{ data: BxProduct[]; total: number }> {
  const { search, categoryIds, limit, sort = "name-asc", page = 0, pageSize = 20 } = params

  let query = supabase
    .from("products")
    .select(
      "id, name, category_id, price_buy, price_sell, stock, sku, barcode, image_url, created_at, updated_at, categories(name)",
      { count: "exact" }
    )

  const s = search?.trim()
  if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)

  switch (sort) {
    case "price-asc":
      query = query.order("price_sell", { ascending: true })
      break
    case "price-desc":
      query = query.order("price_sell", { ascending: false })
      break
    case "stock-asc":
      query = query.order("stock", { ascending: true })
      break
    case "stock-desc":
      query = query.order("stock", { ascending: false })
      break
    default:
      query = query.order("name", { ascending: true })
  }

  if (limit != null) query = query.limit(limit)
  else query = query.range(page * pageSize, page * pageSize + pageSize - 1)

  const { data, count } = await query
  return { data: (data ?? []) as unknown as BxProduct[], total: count ?? 0 }
}
