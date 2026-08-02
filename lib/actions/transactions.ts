"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createTransaction(
  items: {
    product_id: string
    qty: number
    price_sell: number
    subtotal: number
    discount?: number
    variant_id?: string | null
    variant_name?: string | null
  }[],
  payment_method: string = "cash",
  customer_id?: string | null,
  // Jumlah yang benar-benar dibayar saat checkout. Untuk metode "utang" ini bisa
  // 0 (murni utang) atau sebagian (DP). Undefined = dianggap lunas penuh.
  paid_amount?: number,
  // Diskon per nota (nominal rupiah). total disimpan sebagai nilai neto (setelah diskon).
  discount?: number,
  // Biaya layanan / pajak per nota (nominal rupiah). Masuk ke total yang dibayar.
  fee?: number,
  // Jumlah poin loyalitas yang ditukar jadi diskon nota (nominal dihitung server).
  points_redeemed?: number
) {
  const supabase = await createClient()

  // Siapa kasir yang membuat transaksi (untuk detail transaksi & struk).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const rawName = user?.email?.split("@")[0] ?? ""
  const cashierName = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
    : null

  // Normalisasi item: diskon per item dibatasi ≤ subtotal baris (anti nilai negatif).
  const normItems = items.map((i) => ({
    product_id: i.product_id,
    qty: i.qty,
    price_sell: i.price_sell,
    subtotal: i.subtotal,
    discount: Math.max(0, Math.min(Math.round(i.discount ?? 0), i.subtotal)),
    variant_id: i.variant_id || null,
    variant_name: i.variant_name || null,
  }))
  const gross = normItems.reduce((sum, i) => sum + i.subtotal, 0)
  const itemDisc = normItems.reduce((sum, i) => sum + i.discount, 0)
  const disc = Math.max(0, Math.min(gross - itemDisc, Math.round(discount ?? 0)))
  const feeAmount = Math.max(0, Math.round(fee ?? 0))

  // Loyalitas: baca rasio poin & saldo pembeli (server-authoritative), lalu hitung
  // nilai tukar poin yang dipotong dari total. Klausa dibatasi saldo & sisa tagihan.
  let loyaltyConfig = { earnPer: 1000, redeemValue: 100, enabled: true }
  let pointsUsed = 0
  let pointsValue = 0
  if (customer_id) {
    const [settingsRes, custRes] = await Promise.all([
      supabase.from("settings").select("key, value"),
      supabase.from("customers").select("points").eq("id", customer_id).maybeSingle(),
    ])
    const map: Record<string, string> = {}
    for (const row of (settingsRes.data ?? []) as { key: string; value: string }[]) map[row.key] = row.value
    loyaltyConfig = {
      earnPer: Number(map.loyalty_earn_per) || 1000,
      redeemValue: Number(map.loyalty_redeem_value) || 100,
      enabled: map.loyalty_enabled !== "0",
    }
    if (loyaltyConfig.enabled && points_redeemed) {
      const balance = Number((custRes.data as { points?: number } | null)?.points) || 0
      const remaining = Math.max(0, gross - itemDisc - disc)
      const affordable = Math.floor(remaining / loyaltyConfig.redeemValue)
      pointsUsed = Math.max(0, Math.min(Math.round(points_redeemed), balance, affordable))
      pointsValue = pointsUsed * loyaltyConfig.redeemValue
    }
  }

  const total = Math.max(0, gross - itemDisc - disc - pointsValue + feeAmount)

  const isUtang = payment_method === "utang"
  const paid = isUtang
    ? Math.max(0, Math.min(total, Math.round(paid_amount ?? 0)))
    : total
  const status = paid >= total ? "lunas" : "utang"

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      total,
      discount: disc,
      fee: feeAmount,
      payment_method,
      customer_id: customer_id || null,
      paid_amount: paid,
      status,
      user_id: user?.id ?? null,
      cashier_name: cashierName,
    })
    .select()
    .single()

  if (txError) return { error: txError.message }
  if (!transaction) return { error: "Gagal membuat transaksi" }

  // Catat DP awal ke buku pembayaran agar riwayat pelunasan utang lengkap.
  if (isUtang && paid > 0) {
    await supabase
      .from("payments")
      .insert({ transaction_id: transaction.id, amount: paid, method: "cash", note: "DP" })
  }

  await supabase
    .from("transactions")
    .update({ number: transaction.id.slice(0, 8).toUpperCase() })
    .eq("id", transaction.id)

  // Snapshot harga beli (cost) agar laba historis akurat & hitung laba
  // dashboard tak perlu join ke products. Untuk item bervarian pakai harga beli
  // varian (jika ada); kalau tidak, pakai harga beli produk.
  const productIds = [...new Set(normItems.map((i) => i.product_id))]
  const variantIds = [...new Set(normItems.map((i) => i.variant_id).filter(Boolean))]

  const [productRes, variantRes] = await Promise.all([
    supabase.from("products").select("id, price_buy").in("id", productIds),
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, price_buy").in("id", variantIds)
      : Promise.resolve({ data: [] }),
  ])

  const costMap = new Map(
    (productRes.data ?? []).map((p) => [p.id as string, (p.price_buy as number) ?? 0])
  )
  const variantCostMap = new Map(
    (variantRes.data ?? []).map((v) => [v.id as string, (v.price_buy as number) ?? 0])
  )

  const txItems = normItems.map((i) => ({
    ...i,
    transaction_id: transaction.id,
    price_buy:
      (i.variant_id && variantCostMap.get(i.variant_id)) ?? costMap.get(i.product_id) ?? 0,
  }))
  const { error: itemError } = await supabase.from("transaction_items").insert(txItems)

  if (itemError) return { error: itemError.message }

  for (const item of normItems) {
    await supabase.rpc("decrement_stock", { pid: item.product_id, qty: item.qty })
  }

  // Jejak audit stok keluar akibat penjualan (qty negatif = berkurang).
  await supabase.from("stock_movements").insert(
    normItems.map((i) => ({
      product_id: i.product_id,
      type: "out" as const,
      qty: -i.qty,
      note: "Penjualan",
    }))
  )

  // Loyalitas: potong poin yang ditukar, lalu beri poin baru dari total belanja.
  if (customer_id) {
    if (pointsUsed > 0) {
      await supabase.rpc("redeem_loyalty_points", {
        p_customer_id: customer_id,
        p_points: pointsUsed,
        p_transaction_id: transaction.id,
      })
    }
    const earned = Math.min(1000, Math.floor(total / loyaltyConfig.earnPer))
    if (loyaltyConfig.enabled && earned > 0) {
      await supabase.rpc("award_loyalty_points", {
        p_customer_id: customer_id,
        p_points: earned,
        p_transaction_id: transaction.id,
      })
    }
  }

  revalidatePath("/cashier")
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  revalidatePath("/debts")
  revalidatePath("/customers")
  return { error: null, id: transaction.id }
}

// Mencatat pembayaran (cicilan/pelunasan) untuk transaksi utang.
export async function recordPayment(
  transactionId: string,
  amount: number,
  method: string = "cash",
  note?: string
) {
  const supabase = await createClient()
  const amt = Math.round(amount)
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Nominal tidak valid" }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("total, paid_amount")
    .eq("id", transactionId)
    .single()

  if (txErr) return { error: txErr.message }
  if (!tx) return { error: "Transaksi tidak ditemukan" }

  const total = (tx.total as number) ?? 0
  const prevPaid = (tx.paid_amount as number) ?? 0
  const applied = Math.min(amt, Math.max(0, total - prevPaid))
  if (applied <= 0) return { error: "Utang sudah lunas" }

  const { error: payErr } = await supabase
    .from("payments")
    .insert({ transaction_id: transactionId, amount: applied, method, note: note || null })
  if (payErr) return { error: payErr.message }

  const newPaid = prevPaid + applied
  const status = newPaid >= total ? "lunas" : "utang"
  const { error: updErr } = await supabase
    .from("transactions")
    .update({ paid_amount: newPaid, status })
    .eq("id", transactionId)
  if (updErr) return { error: updErr.message }

  revalidatePath("/debts")
  revalidatePath(`/transactions/${transactionId}`)
  return { error: null, paid_amount: newPaid, status }
}

export async function getTransactions() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name, price_buy))")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, transactions: [] }
  return { error: null, transactions: data ?? [] }
}

