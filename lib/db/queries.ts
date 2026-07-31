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
  item_count: number
  customer_name: string | null
}

export async function getTransactions(params: {
  search?: string
  dateFrom?: string | null
  page?: number
  pageSize?: number
}): Promise<{ data: BxTransaction[]; hasMore: boolean }> {
  const { search, dateFrom, page = 0, pageSize = 20 } = params
  // Ambil pageSize + 1 baris: kalau kelebihan 1 berarti masih ada halaman berikutnya
  // (menghindari count exact yang menghitung seluruh baris tiap fetch).
  const { data } = await supabase.rpc("search_transactions", {
    p_search: search?.trim() || null,
    p_date_from: dateFrom ?? null,
    p_limit: pageSize + 1,
    p_offset: page * pageSize,
  })
  const rows = (data ?? []) as BxTransaction[]
  const hasMore = rows.length > pageSize
  return { data: hasMore ? rows.slice(0, pageSize) : rows, hasMore }
}

export async function getTransactionsSummary(params: {
  search?: string
  dateFrom?: string | null
}): Promise<{ count: number; total: number }> {
  const { data } = await supabase.rpc("get_transactions_summary", {
    p_search: params.search?.trim() || null,
    p_date_from: params.dateFrom ?? null,
  })
  const row = (data?.[0] ?? { count: 0, total: 0 }) as { count: number; total: number }
  return { count: Number(row.count) || 0, total: Number(row.total) || 0 }
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

/** Bentuk mentah JSON yang dikembalikan RPC get_dashboard_summary. */
type RpcStat = { value: number; prev: number }
type RpcSummary = {
  revenue: RpcStat
  profit: RpcStat
  count: RpcStat
  items: RpcStat
  trend: { day: string; total: number }[]
  topProducts: BxTopProduct[]
  recent: BxRecentTx[]
  lowStock: BxLowStock[]
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

export async function getDashboardSummary(
  period: BxPeriod = "today"
): Promise<BxDashboardSummary> {
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIOD_DAYS[period]

  // Jendela berjalan [curStart, now]; pembanding = jendela sebelumnya yang sama panjang.
  const curStart = new Date(today0)
  curStart.setDate(curStart.getDate() - (days - 1))
  const prevStart = new Date(curStart)
  prevStart.setDate(prevStart.getDate() - days)

  // Jendela grafik tren (7 batang normal, 30 untuk tampilan bulanan).
  const trendDays = period === "30d" ? 30 : 7
  const trendStart = new Date(today0)
  trendStart.setDate(trendStart.getDate() - (trendDays - 1))

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta"

  // Semua agregasi berat dilakukan di Postgres (lihat migration 00009) — satu round-trip,
  // payload kecil, batas hari dihitung di zona waktu lokal klien.
  const { data } = await supabase.rpc("get_dashboard_summary", {
    p_cur_start: curStart.toISOString(),
    p_prev_start: prevStart.toISOString(),
    p_trend_start: trendStart.toISOString(),
    p_tz: tz,
  })

  const r = (data ?? {}) as Partial<RpcSummary>

  const stat = (value: number, prevValue: number): BxStat => ({
    value,
    prev: prevValue,
    pct: prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null,
  })

  // Susun ulang deret tren lengkap (isi 0 untuk hari tanpa penjualan) + label lokal.
  const totalsByDay = new Map<string, number>()
  for (const t of r.trend ?? []) totalsByDay.set(t.day, t.total)
  const trend: BxTrendDay[] = []
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(today0)
    d.setDate(d.getDate() - i)
    trend.push({
      label: d.toLocaleDateString(
        "id",
        trendDays > 7 ? { day: "numeric" } : { weekday: "short" }
      ),
      total: totalsByDay.get(dayKey(d)) ?? 0,
    })
  }

  const revenue = r.revenue ?? { value: 0, prev: 0 }
  const profit = r.profit ?? { value: 0, prev: 0 }
  const count = r.count ?? { value: 0, prev: 0 }
  const itemsStat = r.items ?? { value: 0, prev: 0 }

  return {
    period,
    revenue: stat(revenue.value, revenue.prev),
    profit: stat(profit.value, profit.prev),
    count: stat(count.value, count.prev),
    items: stat(itemsStat.value, itemsStat.prev),
    avgOrder: count.value > 0 ? Math.round(revenue.value / count.value) : 0,
    itemsPerTx: count.value > 0 ? itemsStat.value / count.value : 0,
    trend,
    recent: r.recent ?? [],
    topProducts: r.topProducts ?? [],
    lowStock: r.lowStock ?? [],
  }
}
