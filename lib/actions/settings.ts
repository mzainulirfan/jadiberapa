"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getSettings() {
  const supabase = await createClient()
  const { data } = await supabase.from("settings").select("*")
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value
  }
  return map
}

export async function updateSetting(key: string, value: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("settings").upsert({ key, value })
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { error: null }
}
