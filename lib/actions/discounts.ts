"use server"

import { createClient } from "@/lib/supabase/server"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

export type DiscountType = "product" | "category" | "global"
export type DiscountValueType = "percent" | "amount"

const VALID_TYPES: DiscountType[] = ["product", "category", "global"]
const VALID_VALUE_TYPES: DiscountValueType[] = ["percent", "amount"]

function cleanProductIds(ids: string[]): string[] {
  const set = new Set<string>()
  for (const id of ids) {
    if (typeof id === "string" && id.trim()) set.add(id.trim())
  }
  return [...set]
}

export async function createDiscount(
  name: string,
  type: DiscountType,
  valueType: DiscountValueType,
  value: number,
  productIds: string[]
) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola diskon" }
  const supabase = await createClient()
  const v = Math.round(Number(value) || 0)
  if (!name?.trim()) return { error: "Nama diskon wajib diisi." }
  if (v <= 0) return { error: "Besar diskon harus lebih dari 0." }
  if (!VALID_TYPES.includes(type)) return { error: "Jenis diskon tidak valid." }
  if (!VALID_VALUE_TYPES.includes(valueType)) return { error: "Bentuk diskon tidak valid." }
  if (type !== "global" && cleanProductIds(productIds).length === 0) {
    return { error: "Pilih minimal satu produk." }
  }

  const { data: rule, error } = await supabase
    .from("discounts")
    .insert({ name: name.trim(), type, value_type: valueType, value: v })
    .select("id")
    .single()
  if (error || !rule) return { error: error?.message ?? "Gagal menyimpan diskon." }

  const ids = cleanProductIds(productIds)
  if (type !== "global" && ids.length > 0) {
    const { error: linkError } = await supabase
      .from("discount_products")
      .insert(ids.map((product_id) => ({ discount_id: rule.id, product_id })))
    if (linkError) return { error: linkError.message }
  }

  revalidatePath("/discounts")
  return { error: null }
}

export async function updateDiscount(
  id: string,
  name: string,
  type: DiscountType,
  valueType: DiscountValueType,
  value: number,
  productIds: string[]
) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola diskon" }
  const supabase = await createClient()
  const v = Math.round(Number(value) || 0)
  if (!name?.trim()) return { error: "Nama diskon wajib diisi." }
  if (v <= 0) return { error: "Besar diskon harus lebih dari 0." }
  if (!VALID_TYPES.includes(type)) return { error: "Jenis diskon tidak valid." }
  if (!VALID_VALUE_TYPES.includes(valueType)) return { error: "Bentuk diskon tidak valid." }
  const ids = cleanProductIds(productIds)
  if (type !== "global" && ids.length === 0) {
    return { error: "Pilih minimal satu produk." }
  }

  const { error: upErr } = await supabase
    .from("discounts")
    .update({ name: name.trim(), type, value_type: valueType, value: v })
    .eq("id", id)
  if (upErr) return { error: upErr.message }

  await supabase.from("discount_products").delete().eq("discount_id", id)
  if (type !== "global" && ids.length > 0) {
    const { error: linkError } = await supabase
      .from("discount_products")
      .insert(ids.map((product_id) => ({ discount_id: id, product_id })))
    if (linkError) return { error: linkError.message }
  }

  revalidatePath("/discounts")
  return { error: null }
}

export async function toggleDiscount(id: string, active: boolean) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola diskon" }
  const supabase = await createClient()
  const { error } = await supabase.from("discounts").update({ active }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/discounts")
  return { error: null }
}

export async function deleteDiscount(id: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa kelola diskon" }
  const supabase = await createClient()
  const { error } = await supabase.from("discounts").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/discounts")
  return { error: null }
}
