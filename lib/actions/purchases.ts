"use server"

import { createClient } from "@/lib/supabase/server"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

export async function createSupplier(name: string, phone?: string, note?: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola supplier" }
  const supabase = await createClient()
  const n = name?.trim()
  if (!n) return { error: "Nama supplier wajib diisi" }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name: n, phone: phone?.trim() || null, note: note?.trim() || null })
    .select("id")
    .single()
  if (error) return { error: error.message }
  if (!data) return { error: "Gagal membuat supplier" }

  revalidatePath("/suppliers")
  return { error: null, id: data.id }
}

export async function updateSupplier(id: string, name: string, phone?: string, note?: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola supplier" }
  const supabase = await createClient()
  const n = name?.trim()
  if (!n) return { error: "Nama supplier wajib diisi" }

  const { error } = await supabase
    .from("suppliers")
    .update({ name: n, phone: phone?.trim() || null, note: note?.trim() || null })
    .eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/suppliers")
  return { error: null }
}

// Menghapus supplier tidak menghapus riwayat pembelian (FK set null di DB).
export async function deleteSupplier(id: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola supplier" }
  const supabase = await createClient()
  const { error } = await supabase.from("suppliers").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/suppliers")
  return { error: null }
}

export type PurchaseItemInput = {
  product_id: string
  qty: number
  price_buy: number
}

export async function createPurchase(
  supplierId: string | null,
  items: PurchaseItemInput[],
  paidAmount?: number,
  note?: string
) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa catat pembelian" }
  const supabase = await createClient()

  const normItems = items
    .map((i) => ({
      product_id: i.product_id,
      qty: Math.round(i.qty),
      price_buy: Math.max(0, Math.round(i.price_buy ?? 0)),
    }))
    .filter((i) => i.product_id && i.qty > 0)
  if (normItems.length === 0) return { error: "Pembelian minimal 1 item" }

  const paid = Math.max(0, Math.round(paidAmount ?? 0))
  const { data, error } = await supabase.rpc("create_purchase", {
    p_supplier_id: supplierId || null,
    p_items: normItems,
    p_paid_amount: paid,
    p_note: note?.trim() || null,
  })
  const res = (data ?? {}) as { error?: string | null; id?: string | null }
  if (error) return { error: error.message }
  if (res.error) return { error: res.error }

  revalidatePath("/purchases")
  revalidatePath("/suppliers")
  revalidatePath("/dashboard")
  revalidatePath("/products")
  return { error: null, id: res.id ?? null }
}

export async function recordSupplierPayment(
  purchaseId: string,
  amount: number,
  method?: string,
  note?: string
) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa catat pembayaran" }
  const supabase = await createClient()

  const amt = Math.round(amount)
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Nominal tidak valid" }

  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_purchase_id: purchaseId,
    p_amount: amt,
    p_method: method?.trim() || "cash",
    p_note: note?.trim() || null,
  })
  const res = (data ?? {}) as { error?: string | null; paid_amount?: number; status?: string }
  if (error) return { error: error.message }
  if (res.error) return { error: res.error }

  revalidatePath(`/purchases/${purchaseId}`)
  revalidatePath("/purchases")
  revalidatePath("/suppliers")
  revalidatePath("/dashboard")
  return { error: null, paid_amount: res.paid_amount ?? null, status: res.status ?? null }
}
