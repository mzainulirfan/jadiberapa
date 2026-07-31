"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getCustomers(search?: string) {
  const supabase = await createClient()
  let query = supabase.from("customers").select("*").order("name")
  if (search) query = query.ilike("name", `%${search}%`)
  const { data } = await query
  return data ?? []
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const { error } = await supabase.from("customers").insert({
    name: raw.name,
    phone: raw.phone || null,
    address: raw.address || null,
  })
  if (error) return { error: error.message }
  revalidatePath("/customers")
  return { error: null }
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const { error } = await supabase.from("customers").update({
    name: raw.name,
    phone: raw.phone || null,
    address: raw.address || null,
  }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/customers")
  return { error: null }
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/customers")
  return { error: null }
}
