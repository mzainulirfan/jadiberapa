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

export async function getCategoryProductCounts(): Promise<Record<string, number>> {
  const { data } = await supabase.from("products").select("category_id")
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { category_id: string | null }[]) {
    if (row.category_id) counts[row.category_id] = (counts[row.category_id] ?? 0) + 1
  }
  return counts
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
  lowStock?: boolean
}): Promise<{ data: BxProduct[]; total: number }> {
  const { search, categoryIds, limit, sort = "name-asc", page = 0, pageSize = 20, lowStock } = params

  let query = supabase
    .from("products")
    .select(
      "id, name, category_id, price_buy, price_sell, stock, sku, barcode, image_url, created_at, updated_at, categories(name)",
      { count: "exact" }
    )

  const s = search?.trim()
  if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)
  if (lowStock) query = query.lte("stock", 5)

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

export async function getInventorySummary(): Promise<{
  count: number
  stockValue: number
  lowStock: number
}> {
  const { data } = await supabase.from("products").select("stock, price_buy")
  const rows = (data ?? []) as { stock: number; price_buy: number }[]
  let stockValue = 0
  let lowStock = 0
  for (const r of rows) {
    stockValue += (r.price_buy ?? 0) * (r.stock ?? 0)
    if ((r.stock ?? 0) <= 5) lowStock += 1
  }
  return { count: rows.length, stockValue, lowStock }
}

export type BxRecentTx = {
  id: string
  number: string | null
  total: number
  payment_method: string
  created_at: string
  customers: { name: string } | null
}

export type BxTopProduct = {
  name: string
  qty: number
  revenue: number
}

export type BxLowStock = {
  id: string
  name: string
  stock: number
}

export type BxTrendDay = {
  label: string
  total: number
}

export type BxPeriod = "today" | "7d" | "30d"

/** A metric with its value in the current period and the previous comparable period. */
export type BxStat = {
  value: number
  prev: number
  /** Percentage change vs previous period; null when there is no baseline (prev === 0). */
  pct: number | null
}

export type BxDashboardSummary = {
  period: BxPeriod
  revenue: BxStat
  profit: BxStat
  count: BxStat
  items: BxStat
  avgOrder: number
  itemsPerTx: number
  trend: BxTrendDay[]
  recent: BxRecentTx[]
  topProducts: BxTopProduct[]
  lowStock: BxLowStock[]
}

const PERIOD_DAYS: Record<BxPeriod, number> = { today: 1, "7d": 7, "30d": 30 }

export async function getDashboardSummary(
  period: BxPeriod = "today"
): Promise<BxDashboardSummary> {
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIOD_DAYS[period]

  // Current window is [curStart, now]; previous is the equally-sized window before it.
  const curStart = new Date(today0)
  curStart.setDate(curStart.getDate() - (days - 1))
  const prevStart = new Date(curStart)
  prevStart.setDate(prevStart.getDate() - days)

  // Trend chart window (7 bars normally, 30 for the monthly view).
  const trendDays = period === "30d" ? 30 : 7
  const trendStart = new Date(today0)
  trendStart.setDate(trendStart.getDate() - (trendDays - 1))

  const earliest = prevStart < trendStart ? prevStart : trendStart
  const curStartMs = curStart.getTime()
  const prevStartMs = prevStart.getTime()

  const [txRes, recentRes, topRes, lowStockRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("total, created_at, transaction_items(qty, products(price_buy))")
      .gte("created_at", earliest.toISOString()),
    supabase
      .from("transactions")
      .select("id, number, total, payment_method, created_at, customers(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("transaction_items")
      .select("qty, subtotal, products(name)")
      .gte("created_at", curStart.toISOString())
      .limit(500),
    supabase
      .from("products")
      .select("id, name, stock")
      .order("stock", { ascending: true })
      .limit(10),
  ])

  const txData = (txRes.data ?? []) as unknown as {
    total: number | null
    created_at: string
    transaction_items:
      | {
          qty: number | null
          products: { price_buy: number | null } | null
        }[]
      | null
  }[]

  // Aggregate revenue/profit/count/items over a [fromMs, toMs) window.
  function aggregate(fromMs: number, toMs: number | null) {
    let revenue = 0
    let cost = 0
    let count = 0
    let itemsQty = 0
    for (const t of txData) {
      const ts = new Date(t.created_at).getTime()
      if (ts < fromMs) continue
      if (toMs !== null && ts >= toMs) continue
      revenue += t.total ?? 0
      count += 1
      for (const i of t.transaction_items ?? []) {
        itemsQty += i.qty ?? 0
        cost += (i.qty ?? 0) * (i.products?.price_buy ?? 0)
      }
    }
    return { revenue, profit: revenue - cost, count, items: itemsQty }
  }

  const cur = aggregate(curStartMs, null)
  const prev = aggregate(prevStartMs, curStartMs)

  const stat = (value: number, prevValue: number): BxStat => ({
    value,
    prev: prevValue,
    pct: prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null,
  })

  const trend: BxTrendDay[] = []
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(today0)
    d.setDate(d.getDate() - i)
    const key = d.toDateString()
    const total = txData
      .filter((t) => new Date(t.created_at).toDateString() === key)
      .reduce((sum, t) => sum + (t.total ?? 0), 0)
    trend.push({
      label: d.toLocaleDateString(
        "id",
        trendDays > 7 ? { day: "numeric" } : { weekday: "short" }
      ),
      total,
    })
  }

  const topData = (topRes.data ?? []) as unknown as {
    qty: number | null
    subtotal: number | null
    products: { name: string } | null
  }[]

  const topMap = new Map<string, BxTopProduct>()
  for (const item of topData) {
    const name = item.products?.name ?? "Produk dihapus"
    const entry = topMap.get(name)
    if (entry) {
      entry.qty += item.qty ?? 0
      entry.revenue += item.subtotal ?? 0
    } else {
      topMap.set(name, {
        name,
        qty: item.qty ?? 0,
        revenue: item.subtotal ?? 0,
      })
    }
  }
  const topProducts = Array.from(topMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)

  const lowStock = (lowStockRes.data ?? [])
    .filter((p) => p.stock <= 3)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock }))

  return {
    period,
    revenue: stat(cur.revenue, prev.revenue),
    profit: stat(cur.profit, prev.profit),
    count: stat(cur.count, prev.count),
    items: stat(cur.items, prev.items),
    avgOrder: cur.count > 0 ? Math.round(cur.revenue / cur.count) : 0,
    itemsPerTx: cur.count > 0 ? cur.items / cur.count : 0,
    trend,
    recent: (recentRes.data ?? []) as unknown as BxRecentTx[],
    topProducts,
    lowStock,
  }
}
