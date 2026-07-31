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

export type BxStoreProfile = { store_name: string; store_phone: string }

const STORE_PROFILE_TTL_MS = 60_000
let storeProfileCache: BxStoreProfile | null = null
let storeProfileFetchedAt = 0
let storeProfilePromise: Promise<BxStoreProfile> | null = null

// Profil ringkas untuk kartu di halaman More: query Supabase langsung (tanpa server
// action) + cache TTL, hanya ambil field yang dipakai (bukan select("*")).
export function getStoreProfile(): Promise<BxStoreProfile> {
  const now = Date.now()
  if (storeProfileCache && now - storeProfileFetchedAt < STORE_PROFILE_TTL_MS) {
    return Promise.resolve(storeProfileCache)
  }
  if (!storeProfilePromise) {
    storeProfilePromise = (async () => {
      try {
        const { data } = await supabase
          .from("settings")
          .select("key, value")
          .in("key", ["store_name", "store_phone"])
        const map: Record<string, string> = {}
        for (const row of (data ?? []) as { key: string; value: string }[]) {
          map[row.key] = row.value
        }
        storeProfileCache = {
          store_name: map.store_name ?? "",
          store_phone: map.store_phone ?? "",
        }
        storeProfileFetchedAt = Date.now()
        return storeProfileCache
      } finally {
        storeProfilePromise = null
      }
    })()
  }
  return storeProfilePromise
}

export function invalidateStoreProfile() {
  storeProfileCache = null
  storeProfileFetchedAt = 0
}

const SETTINGS_TTL_MS = 60_000
let settingsCache: Record<string, string> | null = null
let settingsFetchedAt = 0
let settingsPromise: Promise<Record<string, string>> | null = null

// Seluruh settings (key/value) untuk form pengaturan, checkout, & detail transaksi:
// query Supabase langsung (tanpa server action) + cache TTL karena nyaris statis.
export function getSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (settingsCache && now - settingsFetchedAt < SETTINGS_TTL_MS) {
    return Promise.resolve(settingsCache)
  }
  if (!settingsPromise) {
    settingsPromise = (async () => {
      try {
        const { data } = await supabase.from("settings").select("key, value")
        const map: Record<string, string> = {}
        for (const row of (data ?? []) as { key: string; value: string }[]) {
          map[row.key] = row.value
        }
        settingsCache = map
        settingsFetchedAt = Date.now()
        return settingsCache
      } finally {
        settingsPromise = null
      }
    })()
  }
  return settingsPromise
}

export function invalidateSettings() {
  settingsCache = null
  settingsFetchedAt = 0
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

// Detail 1 transaksi: query Supabase langsung dari client (bukan server action)
// agar hilang overhead round-trip + antrean server action. Ambil di primary key.
export async function getTransaction(id: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name)), customers(name)")
    .eq("id", id)
    .single()

  if (error) return { error: error.message, transaction: null }
  return { error: null, transaction: data }
}

export type BxDebt = {
  id: string
  number: string | null
  total: number
  paid_amount: number
  created_at: string
  customer_id: string | null
  customer_name: string | null
}

// Daftar transaksi yang masih berutang (status = 'utang'), tertua dulu.
export async function getDebts(): Promise<BxDebt[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, number, total, paid_amount, created_at, customer_id, customers(name)")
    .eq("status", "utang")
    .order("created_at", { ascending: true })

  type Row = {
    id: string
    number: string | null
    total: number
    paid_amount: number
    created_at: string
    customer_id: string | null
    customers: { name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    number: r.number,
    total: r.total,
    paid_amount: r.paid_amount ?? 0,
    created_at: r.created_at,
    customer_id: r.customer_id,
    customer_name: r.customers?.name ?? null,
  }))
}

export type BxPayment = {
  id: string
  amount: number
  method: string
  note: string | null
  created_at: string
}

// Riwayat pembayaran (DP + cicilan) sebuah transaksi.
export async function getPayments(transactionId: string): Promise<BxPayment[]> {
  const { data } = await supabase
    .from("payments")
    .select("id, amount, method, note, created_at")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true })
  return (data ?? []) as unknown as BxPayment[]
}

export async function getProducts(params: {
  search?: string
  categoryIds?: string[]
  limit?: number
  sort?: ProductSort
  page?: number
  pageSize?: number
  lowStock?: boolean
  withCount?: boolean
}): Promise<{ data: BxProduct[]; total: number }> {
  const { search, categoryIds, limit, sort = "name-asc", page = 0, pageSize = 20, lowStock, withCount = false } = params

  // count: "exact" memaksa Postgres menghitung seluruh baris yang cocok tiap query.
  // Hanya diminta bila pemanggil butuh total (paginasi halaman Produk); kasir/cart tidak.
  let query = supabase
    .from("products")
    .select(
      "id, name, category_id, price_buy, price_sell, stock, min_stock, sku, barcode, image_url, created_at, updated_at, categories(name)",
      withCount ? { count: "exact" } : undefined
    )

  const s = search?.trim()
  if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)
  if (lowStock) query = query.eq("is_low_stock", true)

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
  const { data } = await supabase.rpc("get_inventory_summary")
  const row = (data?.[0] ?? { count: 0, stock_value: 0, low_stock: 0 }) as {
    count: number
    stock_value: number
    low_stock: number
  }
  return {
    count: Number(row.count) || 0,
    stockValue: Number(row.stock_value) || 0,
    lowStock: Number(row.low_stock) || 0,
  }
}

export type BxStockMovement = {
  id: string
  type: "in" | "out" | "adjust"
  qty: number
  note: string | null
  created_at: string
}

export async function getStockMovements(
  productId: string,
  limit = 20
): Promise<BxStockMovement[]> {
  const { data } = await supabase
    .from("stock_movements")
    .select("id, type, qty, note, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as BxStockMovement[]
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

export type BxReports = {
  totalRevenue: number
  totalCost: number
  profit: number
  totalExpenses: number
  netProfit: number
  count: number
  totalItems: number
  payment: { key: string; value: number }[]
  topProducts: { name: string; qty: number; total: number }[]
  trend: { t: string; value: number }[]
}

/** Bentuk mentah JSON yang dikembalikan RPC get_reports_summary. */
type RpcReports = {
  totalRevenue: number
  totalCost: number
  totalExpenses: number
  count: number
  totalItems: number
  payment: { key: string; value: number }[]
  topProducts: { name: string; qty: number; total: number }[]
  trend: { t: string; value: number }[]
}

// Semua agregasi laporan dilakukan di Postgres (lihat migration 00013) — satu round-trip,
// payload kecil, tanpa mengirim transaksi mentah. `bucket` menentukan granularitas tren
// (per jam utk "Hari Ini", per hari utk lainnya); batas periode dihitung di zona lokal.
export async function getReports(
  from: string | undefined,
  bucket: "hour" | "day"
): Promise<BxReports> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta"
  const { data } = await supabase.rpc("get_reports_summary", {
    p_from: from ?? null,
    p_to: null,
    p_bucket: bucket,
    p_tz: tz,
  })
  const r = (data ?? {}) as Partial<RpcReports>
  const totalRevenue = Number(r.totalRevenue) || 0
  const totalCost = Number(r.totalCost) || 0
  const totalExpenses = Number(r.totalExpenses) || 0
  const profit = totalRevenue - totalCost
  return {
    totalRevenue,
    totalCost,
    profit,
    totalExpenses,
    netProfit: profit - totalExpenses,
    count: Number(r.count) || 0,
    totalItems: Number(r.totalItems) || 0,
    payment: (r.payment ?? []).map((p) => ({ key: p.key, value: Number(p.value) || 0 })),
    topProducts: (r.topProducts ?? []).map((p) => ({
      name: p.name,
      qty: Number(p.qty) || 0,
      total: Number(p.total) || 0,
    })),
    trend: (r.trend ?? []).map((t) => ({ t: t.t, value: Number(t.value) || 0 })),
  }
}

export type BxExpense = {
  id: string
  amount: number
  category: string
  note: string | null
  created_at: string
}

export async function getExpenses(from?: string, to?: string): Promise<BxExpense[]> {
  let query = supabase
    .from("expenses")
    .select("id, amount, category, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
  if (from) query = query.gte("created_at", from)
  if (to) query = query.lte("created_at", to)
  const { data } = await query
  return (data ?? []) as unknown as BxExpense[]
}

export type BxCashSession = {
  id: string
  opening: number
  closing: number | null
  expected: number | null
  diff: number | null
  note: string | null
  opened_at: string
  closed_at: string | null
}

export async function getActiveShift(): Promise<BxCashSession | null> {
  const { data } = await supabase
    .from("cash_sessions")
    .select("id, opening, closing, expected, diff, note, opened_at, closed_at")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as unknown as BxCashSession) ?? null
}

export async function getShifts(limit = 20): Promise<BxCashSession[]> {
  const { data } = await supabase
    .from("cash_sessions")
    .select("id, opening, closing, expected, diff, note, opened_at, closed_at")
    .not("closed_at", "is", null)
    .order("opened_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as BxCashSession[]
}

// Kas tunai sejak sesi dibuka (penjualan tunai + pembayaran tunai) untuk shift berjalan.
export async function getShiftSummary(
  openedAt: string
): Promise<{ cashSales: number; txCount: number }> {
  const { data } = await supabase.rpc("get_shift_summary", { p_opened_at: openedAt })
  const r = (data ?? {}) as { cashSales?: number; txCount?: number }
  return { cashSales: Number(r.cashSales) || 0, txCount: Number(r.txCount) || 0 }
}
