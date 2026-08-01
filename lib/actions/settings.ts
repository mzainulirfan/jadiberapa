"use server"

import { createClient } from "@/lib/supabase/server"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

export async function updateSetting(key: string, value: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa ubah pengaturan" }
  const supabase = await createClient()

  // Settings kini per toko (PK store_id + key). Ambil toko aktif user dulu.
  const { data: member } = await supabase
    .from("store_members")
    .select("store_id")
    .limit(1)
    .maybeSingle()
  if (!member) return { error: "Toko tidak ditemukan" }

  const { error } = await supabase
    .from("settings")
    .upsert(
      { store_id: member.store_id as string, key, value },
      { onConflict: "store_id,key" }
    )
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { error: null }
}
