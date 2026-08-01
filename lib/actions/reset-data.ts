"use server"

import { revalidatePath } from "next/cache"
import { isOwner } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"

type ResetResult = {
  error: string | null
  deletedStores: number
  deletedUsers: number
}

async function deleteAllAuthUsers() {
  const admin = createAdminClient()
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY belum diset", deletedUsers: 0 }

  let deletedUsers = 0
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return { error: error.message, deletedUsers }

    const users = data.users ?? []
    if (users.length === 0) break

    for (const user of users) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (deleteError) return { error: deleteError.message, deletedUsers }
      deletedUsers += 1
    }

    if (users.length < perPage) break
    page += 1
  }

  return { error: null, deletedUsers }
}

export async function wipeAllData(formData: FormData): Promise<ResetResult> {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa menghapus semua data", deletedStores: 0, deletedUsers: 0 }

  const confirm = String(formData.get("confirm") ?? "").trim()
  if (confirm !== "HAPUS SEMUA") {
    return { error: 'Ketik "HAPUS SEMUA" untuk konfirmasi', deletedStores: 0, deletedUsers: 0 }
  }

  const admin = createAdminClient()
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY belum diset", deletedStores: 0, deletedUsers: 0 }

  const { data: stores, error: storeError } = await admin.from("stores").select("id")
  if (storeError) return { error: storeError.message, deletedStores: 0, deletedUsers: 0 }

  const deletedStores = stores?.length ?? 0
  if (deletedStores > 0) {
    const { error } = await admin.from("stores").delete().in(
      "id",
      (stores ?? []).map((row) => row.id)
    )
    if (error) return { error: error.message, deletedStores: 0, deletedUsers: 0 }
  }

  const usersRes = await deleteAllAuthUsers()
  if (usersRes.error) return { error: usersRes.error, deletedStores, deletedUsers: usersRes.deletedUsers }

  for (const path of ["/", "/dashboard", "/products", "/categories", "/transactions", "/reports", "/expenses", "/cashier", "/debts", "/shift", "/more", "/backup", "/demo-data", "/settings", "/staff", "/login"]) {
    revalidatePath(path)
  }

  return { error: null, deletedStores, deletedUsers: usersRes.deletedUsers }
}
