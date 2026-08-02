"use client"

import { createClient } from "@/lib/supabase/client"
import type { BxProduct, BxCategory, BxVariant } from "@/components/products/types"
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

export type BxDiscount = {
  id: string
  name: string
  type: "product" | "category" | "global"
  value_type: "percent" | "amount"
  value: number
  active: boolean
  created_at: string
  updated_at: string
  product_ids: string[]
}

const DISCOUNT_TTL_MS = 60_000
let discountsCache: BxDiscount[] | null = null
let discountsFetchedAt = 0
let discountsPromise: Promise<BxDiscount[]> | null = null

// Aturan diskon + produk terdampak. Query langsung dari client + cache TTL (nyaris
// statis). Panggil invalidateDiscounts() setelah mutasi agar kasir segera memakai
// aturan terbaru.
export function getDiscounts(): Promise<BxDiscount[]> {
  const now = Date.now()
  if (discountsCache && now - discountsFetchedAt < DISCOUNT_TTL_MS) {
    return Promise.resolve(discountsCache)
  }
  if (!discountsPromise) {
    discountsPromise = (async () => {
      try {
        const [{ data: rules }, { data: links }] = await Promise.all([
          supabase
            .from("discounts")
            .select("id, name, type, value_type, value, active, created_at, updated_at")
            .order("created_at", { ascending: false }),
          supabase.from("discount_products").select("discount_id, product_id"),
        ])
        const byRule: Record<string, string[]> = {}
        for (const l of (links ?? []) as { discount_id: string; product_id: string }[]) {
          if (!byRule[l.discount_id]) byRule[l.discount_id] = []
          byRule[l.discount_id].push(l.product_id)
        }
        discountsCache = ((rules ?? []) as Omit<BxDiscount, "product_ids">[]).map((r) => ({
          ...r,
          product_ids: byRule[r.id] ?? [],
        }))
        discountsFetchedAt = Date.now()
        return discountsCache
      } finally {
        discountsPromise = null
      }
    })()
  }
  return discountsPromise
}

export function invalidateDiscounts() {
  discountsCache = null
  discountsFetchedAt = 0
}

const DISCOUNT_TYPE_ORDER: Record<BxDiscount["type"], number> = {
  product: 0,
  category: 1,
  global: 2,
}

// Diskon efektif (Rp per unit) untuk satu produk: prioritas produk > kategori > global;
// di level yang sama ambil yang terbesar. Dibatasi agar tidak melebihi harga jual.
export function resolveDiscountAmount(
  productId: string,
  priceSell: number,
  rules: BxDiscount[]
): number {
  const candidates: { type: BxDiscount["type"]; amount: number }[] = []
  for (const r of rules) {
    if (!r.active || r.value <= 0) continue
    if (r.type !== "global" && !r.product_ids.includes(productId)) continue
    const amount =
      r.value_type === "percent"
        ? Math.round((priceSell * r.value) / 100)
        : r.value
    if (amount > 0) candidates.push({ type: r.type, amount })
  }
  candidates.sort(
    (a, b) =>
      DISCOUNT_TYPE_ORDER[a.type] - DISCOUNT_TYPE_ORDER[b.type] || b.amount - a.amount
  )
  const best = candidates[0]
  if (!best) return 0
  return Math.min(best.amount, priceSell)
}

export type BxStoreProfile = { store_name: string; store_phone: string; store_code: string }

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
        const [{ data: settingsData }, { data: storeId }] = await Promise.all([
          supabase
            .from("settings")
            .select("key, value")
            .in("key", ["store_name", "store_phone"]),
          supabase.rpc("current_store_id"),
        ])
        const { data: storeData } = storeId
          ? await supabase.from("stores").select("code").eq("id", storeId).single()
          : { data: null }
        const map: Record<string, string> = {}
        for (const row of (settingsData ?? []) as { key: string; value: string }[]) {
          map[row.key] = row.value
        }
        storeProfileCache = {
          store_name: map.store_name ?? "",
          store_phone: map.store_phone ?? "",
          store_code: (storeData as { code?: string } | null)?.code ?? "",
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

export type BxStore = {
  store_id: string
  name: string
  role: "owner" | "kasir"
  active: boolean
}

// Daftar toko user + peran + toko aktif (RPC security definer).
export async function getMyStores(): Promise<BxStore[]> {
  const { data } = await supabase.rpc("get_my_stores")
  return (data as BxStore[]) ?? []
}

// Ganti toko aktif. Mengembalikan pesan error, atau null bila sukses.
export async function setActiveStore(storeId: string): Promise<string | null> {
  const { data } = await supabase.rpc("set_active_store", { p_store_id: storeId })
  return (data as { error?: string | null } | null)?.error ?? null
}

// Cari toko berdasarkan kode (untuk validasi saat kasir mendaftar). null = tidak ada.
export async function getStoreByCode(code: string): Promise<{ store_id: string; name: string } | null> {
  const { data } = await supabase.rpc("get_store_by_code", { p_code: code })
  return (data as { store_id: string; name: string } | null) ?? null
}

// Kode toko aktif (dibagikan owner agar kasir bisa bergabung).
export async function getCurrentStoreCode(): Promise<string> {
  const { data: sid } = await supabase.rpc("current_store_id")
  if (!sid) return ""
  const { data } = await supabase.from("stores").select("code").eq("id", sid).single()
  return (data as { code?: string } | null)?.code ?? ""
}

export type BxStaffMember = {
  user_id: string
  role: "owner" | "kasir"
  username: string
  created_at: string
}

export async function getStoreMembers(): Promise<{
  error: string | null
  members: BxStaffMember[]
}> {
  const { data } = await supabase.rpc("get_store_members")
  const res = (data as { error?: string | null; members?: BxStaffMember[] } | null) ?? {}
  return { error: res.error ?? null, members: res.members ?? [] }
}

export async function inviteKasir(username: string): Promise<string | null> {
  const { data } = await supabase.rpc("invite_kasir", { p_username: username })
  return (data as { error?: string | null } | null)?.error ?? null
}

export async function removeMember(userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("remove_member", { p_user_id: userId })
  return (data as { error?: string | null } | null)?.error ?? null
}

export type StoreDeletionStats = {
  products: number
  categories: number
  customers: number
  transactions: number
}

// Ringkasan jumlah data toko aktif untuk ditampilkan di zona berbahaya.
export async function getStoreDeletionStats(): Promise<StoreDeletionStats> {
  const [products, categories, customers, transactions] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
  ])
  return {
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    customers: customers.count ?? 0,
    transactions: transactions.count ?? 0,
  }
}

// Hapus seluruh cache data yang bergantung pada toko aktif (setelah ganti toko).
export function invalidateAllDataCaches() {
  invalidateCategories()
  invalidateDiscounts()
  invalidateSettings()
  invalidateStoreProfile()
}

export type StoreTemplateOnboardingState = {
  empty: boolean
  templateKey: string | null
}

export async function getStoreTemplateOnboardingState(): Promise<StoreTemplateOnboardingState> {
  const { data: storeId } = await supabase.rpc("current_store_id")
  if (!storeId) return { empty: false, templateKey: null }

  const [{ count: productCount }, { count: categoryCount }, { data: store }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("stores").select("template_key").eq("id", storeId).single(),
  ])

  return {
    empty: (productCount ?? 0) === 0 && (categoryCount ?? 0) === 0,
    templateKey: (store as { template_key?: string | null } | null)?.template_key ?? null,
  }
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
  isFavorite?: boolean
  withCount?: boolean
}): Promise<{ data: BxProduct[]; total: number }> {
  const { search, categoryIds, limit, sort = "name-asc", page = 0, pageSize = 20, lowStock, isFavorite, withCount = false } = params

  // count: "exact" memaksa Postgres menghitung seluruh baris yang cocok tiap query.
  // Hanya diminta bila pemanggil butuh total (paginasi halaman Produk); kasir/cart tidak.
  let query = supabase
    .from("products")
    .select(
      "id, name, category_id, price_buy, price_sell, stock, min_stock, is_favorite, unit, sku, barcode, image_url, created_at, updated_at, categories(name)",
      withCount ? { count: "exact" } : undefined
    )

  const s = search?.trim()
  if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)
  if (lowStock) query = query.eq("is_low_stock", true)
  if (isFavorite) query = query.eq("is_favorite", true)

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

export async function getProductVariants(productIds: string[]): Promise<BxVariant[]> {
  if (productIds.length === 0) return []
  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .in("product_id", productIds)
    .order("created_at", { ascending: true })
  return (data ?? []) as unknown as BxVariant[]
}

export async function getProductVariantsByProduct(productId: string): Promise<BxVariant[]> {
  return getProductVariants([productId])
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
  grossProfit: BxStat
  expenses: BxStat
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
  grossProfit?: RpcStat
  expenses?: RpcStat
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
  const grossProfit = r.grossProfit ?? r.profit ?? { value: 0, prev: 0 }
  const expenses = r.expenses ?? { value: 0, prev: 0 }
  const profit = r.profit ?? {
    value: grossProfit.value - expenses.value,
    prev: grossProfit.prev - expenses.prev,
  }
  const count = r.count ?? { value: 0, prev: 0 }
  const itemsStat = r.items ?? { value: 0, prev: 0 }

  return {
    period,
    revenue: stat(revenue.value, revenue.prev),
    grossProfit: stat(grossProfit.value, grossProfit.prev),
    expenses: stat(expenses.value, expenses.prev),
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
  purchases: BxPurchasesReport
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
  const [reportRes, expenseRes, purchaseRes] = await Promise.all([
    supabase.rpc("get_reports_summary", {
      p_from: from ?? null,
      p_to: null,
      p_bucket: bucket,
      p_tz: tz,
    }),
    (async () => {
      let query = supabase.from("expenses").select("amount")
      if (from) query = query.gte("created_at", from)
      const { data } = await query
      return (data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    })(),
    getPurchasesReport(from),
  ])
  const { data } = reportRes
  const r = (data ?? {}) as Partial<RpcReports>
  const totalRevenue = Number(r.totalRevenue) || 0
  const totalCost = Number(r.totalCost) || 0
  const totalExpenses = r.totalExpenses == null ? expenseRes : Number(r.totalExpenses) || 0
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
    purchases: purchaseRes,
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

export type BxSupplier = {
  id: string
  name: string
  phone: string | null
  note: string | null
}

const SUPPLIER_TTL_MS = 60_000
let suppliersCache: BxSupplier[] | null = null
let suppliersFetchedAt = 0
let suppliersPromise: Promise<BxSupplier[]> | null = null

// Daftar supplier (nyaris statis). Query langsung dari client + cache TTL.
export function getSuppliers(search?: string): Promise<BxSupplier[]> {
  const now = Date.now()
  if (suppliersCache && now - suppliersFetchedAt < SUPPLIER_TTL_MS) {
    const s = search?.trim().toLowerCase()
    if (!s) return Promise.resolve(suppliersCache)
    return Promise.resolve(
      suppliersCache.filter((sup) => sup.name.toLowerCase().includes(s))
    )
  }
  if (!suppliersPromise) {
    suppliersPromise = (async () => {
      try {
        const { data } = await supabase.from("suppliers").select("id, name, phone, note").order("name")
        suppliersCache = (data ?? []) as unknown as BxSupplier[]
        suppliersFetchedAt = Date.now()
        return suppliersCache
      } finally {
        suppliersPromise = null
      }
    })()
  }
  return suppliersPromise.then((list) => {
    const s = search?.trim().toLowerCase()
    if (!s) return list
    return list.filter((sup) => sup.name.toLowerCase().includes(s))
  })
}

export function invalidateSuppliers() {
  suppliersCache = null
  suppliersFetchedAt = 0
}

export type BxPurchase = {
  id: string
  number: string
  supplier_id: string | null
  supplier_name: string | null
  total: number
  paid_amount: number
  status: "lunas" | "utang"
  created_at: string
  item_count: number
}

// Daftar nota beli (filter status opsional), terbaru dulu.
export async function getPurchases(params?: {
  status?: "lunas" | "utang"
}): Promise<BxPurchase[]> {
  let query = supabase
    .from("purchases")
    .select("id, number, supplier_id, total, paid_amount, status, created_at, suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(200)
  if (params?.status) query = query.eq("status", params.status)

  type Row = {
    id: string
    number: string
    supplier_id: string | null
    total: number
    paid_amount: number
    status: "lunas" | "utang"
    created_at: string
    suppliers: { name: string } | null
  }
  const { data } = await query
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    number: r.number,
    supplier_id: r.supplier_id,
    supplier_name: r.suppliers?.name ?? null,
    total: r.total,
    paid_amount: r.paid_amount ?? 0,
    status: r.status,
    created_at: r.created_at,
    item_count: 0,
  }))
}

export type BxPurchaseDetail = {
  id: string
  number: string
  supplier_id: string | null
  supplier_name: string | null
  total: number
  paid_amount: number
  status: "lunas" | "utang"
  note: string | null
  cashier_name: string | null
  created_at: string
  items: {
    id: string
    qty: number
    price_buy: number
    subtotal: number
    product_name: string | null
  }[]
  payments: BxSupplierPayment[]
}

// Detail 1 nota beli: nota + item (+ nama produk) + supplier + riwayat pembayaran.
export async function getPurchase(id: string): Promise<{
  error: string | null
  purchase: BxPurchaseDetail | null
}> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, purchase_items(*, products(name)), suppliers(name), supplier_payments(*)")
    .eq("id", id)
    .single()

  if (error) return { error: error.message, purchase: null }
  const p = data as {
    id: string
    number: string
    supplier_id: string | null
    total: number
    paid_amount: number
    status: "lunas" | "utang"
    note: string | null
    cashier_name: string | null
    created_at: string
    purchase_items: {
      id: string
      qty: number
      price_buy: number
      subtotal: number
      products: { name: string } | null
    }[]
    suppliers: { name: string } | null
    supplier_payments: {
      id: string
      amount: number
      method: string
      note: string | null
      created_at: string
    }[]
  }
  return {
    error: null,
    purchase: {
      id: p.id,
      number: p.number,
      supplier_id: p.supplier_id,
      supplier_name: p.suppliers?.name ?? null,
      total: p.total,
      paid_amount: p.paid_amount ?? 0,
      status: p.status,
      note: p.note,
      cashier_name: p.cashier_name,
      created_at: p.created_at,
      items: (p.purchase_items ?? []).map((i) => ({
        id: i.id,
        qty: i.qty,
        price_buy: i.price_buy,
        subtotal: i.subtotal,
        product_name: i.products?.name ?? null,
      })),
      payments: (p.supplier_payments ?? []).map((pm) => ({
        id: pm.id,
        amount: pm.amount,
        method: pm.method,
        note: pm.note,
        created_at: pm.created_at,
      })),
    },
  }
}

export type BxSupplierDebt = {
  id: string
  number: string
  total: number
  paid_amount: number
  created_at: string
  supplier_id: string | null
  supplier_name: string | null
}

// Nota beli yang masih berutang ke supplier (status = 'utang'), tertua dulu.
export async function getSupplierDebts(): Promise<BxSupplierDebt[]> {
  const { data } = await supabase
    .from("purchases")
    .select("id, number, total, paid_amount, created_at, supplier_id, suppliers(name)")
    .eq("status", "utang")
    .order("created_at", { ascending: true })

  type Row = {
    id: string
    number: string
    total: number
    paid_amount: number
    created_at: string
    supplier_id: string | null
    suppliers: { name: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    number: r.number,
    total: r.total,
    paid_amount: r.paid_amount ?? 0,
    created_at: r.created_at,
    supplier_id: r.supplier_id,
    supplier_name: r.suppliers?.name ?? null,
  }))
}

export type BxSupplierPayment = {
  id: string
  amount: number
  method: string
  note: string | null
  created_at: string
}

// Riwayat pembayaran (DP + cicilan) sebuah nota beli.
export async function getSupplierPayments(purchaseId: string): Promise<BxSupplierPayment[]> {
  const { data } = await supabase
    .from("supplier_payments")
    .select("id, amount, method, note, created_at")
    .eq("purchase_id", purchaseId)
    .order("created_at", { ascending: true })
  return (data ?? []) as unknown as BxSupplierPayment[]
}

export type BxPurchasesReport = {
  totalPurchases: number
  outstandingDebt: number
}

// Ringkasan pembelian (nilai nota dalam rentang) + utang supplier berjalan.
export async function getPurchasesReport(from?: string, to?: string): Promise<BxPurchasesReport> {
  const { data } = await supabase.rpc("get_purchases_summary", {
    p_from: from ?? null,
    p_to: to ?? null,
  })
  const r = (data ?? {}) as { totalPurchases?: number; outstandingDebt?: number }
  return {
    totalPurchases: Number(r.totalPurchases) || 0,
    outstandingDebt: Number(r.outstandingDebt) || 0,
  }
}

export type BxMarginProduct = {
  id: string
  name: string
  stock: number
  qty: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
}

export type BxBusyHour = { hour: number; value: number }

export type BxBusyDay = { day: number; value: number }

export type BxRestockSuggestion = {
  id: string
  name: string
  stock: number
  minStock: number
  sold: number
  daysLeft: number | null
}

export type BxDeadStock = {
  id: string
  name: string
  stock: number
  lastSold: string | null
  daysIdle: number | null
}

export type BxAnalytics = {
  margins: BxMarginProduct[]
  busyHours: BxBusyHour[]
  busyDays: BxBusyDay[]
  restock: BxRestockSuggestion[]
  deadStock: BxDeadStock[]
}

// Analitik Fase B: margin per produk + jam/hari sibuk (periode) + saran restock
// (lookback 14 hari) + barang mati (lookback 30 hari). RPC non-security-definer,
// jadi pemfilteran toko otomatis via RLS. Normalisasi angka dari jsonb.
export async function getAnalytics(from?: string, to?: string): Promise<BxAnalytics> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta"
  const { data } = await supabase.rpc("get_analytics_summary", {
    p_from: from ?? null,
    p_to: to ?? null,
    p_tz: tz,
    p_restock_days: 14,
    p_dead_days: 30,
  })
  const r = (data ?? {}) as Partial<BxAnalytics>
  return {
    margins: (r.margins ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      stock: Number(m.stock) || 0,
      qty: Number(m.qty) || 0,
      revenue: Number(m.revenue) || 0,
      cost: Number(m.cost) || 0,
      profit: Number(m.profit) || 0,
      marginPct: Number(m.marginPct) || 0,
    })),
    busyHours: (r.busyHours ?? []).map((b) => ({
      hour: Number(b.hour) || 0,
      value: Number(b.value) || 0,
    })),
    busyDays: (r.busyDays ?? []).map((d) => ({
      day: Number(d.day) || 0,
      value: Number(d.value) || 0,
    })),
    restock: (r.restock ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      stock: Number(s.stock) || 0,
      minStock: Number(s.minStock) || 0,
      sold: Number(s.sold) || 0,
      daysLeft: s.daysLeft == null ? null : Math.round(Number(s.daysLeft)),
    })),
    deadStock: (r.deadStock ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      stock: Number(d.stock) || 0,
      lastSold: d.lastSold ?? null,
      daysIdle: d.daysIdle == null ? null : Number(d.daysIdle),
    })),
  }
}
