"use server"

import { createClient } from "@/lib/supabase/server"

export async function getDashboardData() {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const [
    { count: todayCount },
    { data: todayData },
    { data: recentTransactions },
    { data: topProducts },
  ] = await Promise.all([
    supabase.from("transactions").select("*", { count: "exact", head: true }).gte("created_at", todayStr),
    supabase
      .from("transactions")
      .select("total, transaction_items(qty)")
      .gte("created_at", todayStr),
    supabase.from("transactions").select("id, total, created_at").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("transaction_items")
      .select("product_id, products(name), qty")
      .order("qty", { ascending: false })
      .limit(5),
  ])

  const todayTotal = todayData?.reduce((sum, t) => sum + t.total, 0) ?? 0
  const todayItems = todayData?.reduce((sum, t) => sum + (t.transaction_items?.reduce((s: number, i: any) => s + i.qty, 0) ?? 0), 0) ?? 0

  return {
    todayTotal,
    todayCount: todayCount ?? 0,
    todayItems,
    recentTransactions: recentTransactions ?? [],
    topProducts: topProducts ?? [],
  }
}
