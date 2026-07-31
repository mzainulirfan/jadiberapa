"use server"

import { createClient } from "@/lib/supabase/server"

export async function getReports(from?: string, to?: string) {
  const supabase = await createClient()

  let query = supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name, price_buy))")
    .order("created_at", { ascending: false })

  if (from) query = query.gte("created_at", from)
  if (to) query = query.lte("created_at", to)

  const { data: transactions } = await query

  const totalRevenue = transactions?.reduce((s, t) => s + t.total, 0) ?? 0
  const totalItems = transactions?.reduce((s, t) =>
    s + (t.transaction_items?.reduce((si: number, i: any) => si + i.qty, 0) ?? 0), 0) ?? 0
  const totalCost = transactions?.reduce((s, t) =>
    s + (t.transaction_items?.reduce((si: number, i: any) => si + (i.products?.price_buy ?? 0) * i.qty, 0) ?? 0), 0) ?? 0

  const productSales: Record<string, { name: string; qty: number; total: number }> = {}
  for (const tx of transactions ?? []) {
    for (const item of tx.transaction_items ?? []) {
      const p = item.products
      if (!p) continue
      if (!productSales[p.name]) productSales[p.name] = { name: p.name, qty: 0, total: 0 }
      productSales[p.name].qty += item.qty
      productSales[p.name].total += item.subtotal
    }
  }
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty)

  return {
    transactions: transactions ?? [],
    totalRevenue,
    totalItems,
    totalCost,
    profit: totalRevenue - totalCost,
    topProducts,
    count: transactions?.length ?? 0,
  }
}
