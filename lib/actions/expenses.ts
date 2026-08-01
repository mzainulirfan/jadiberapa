"use server"

import { createClient } from "@/lib/supabase/server"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

export async function createExpense(amount: number, category: string, note?: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa catat pengeluaran" }
  const supabase = await createClient()
  const amt = Math.round(amount)
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Nominal pengeluaran tidak valid" }

  const { error } = await supabase.from("expenses").insert({
    amount: amt,
    category: category?.trim() || "lainnya",
    note: note?.trim() || null,
  })
  if (error) return { error: error.message }

  revalidatePath("/expenses")
  revalidatePath("/reports")
  revalidatePath("/dashboard")
  return { error: null }
}

export async function deleteExpense(id: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa hapus pengeluaran" }
  const supabase = await createClient()
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/expenses")
  revalidatePath("/reports")
  revalidatePath("/dashboard")
  return { error: null }
}
