"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const { data, error } = await supabase.rpc("create_customer_contact", {
    p_name: String(raw.name ?? ""),
    p_phone: raw.phone ? String(raw.phone) : null,
    p_address: raw.address ? String(raw.address) : null,
  })
  if (error) return { error: error.message, id: null }
  const result = (data ?? {}) as { error?: string | null; id?: string | null }
  if (result.error) return { error: result.error, id: null }
  revalidatePath("/customers")
  return { error: null, id: result.id ?? null }
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)
  const { data, error } = await supabase.rpc("update_customer_contact", {
    p_customer_id: id,
    p_name: String(raw.name ?? ""),
    p_phone: raw.phone ? String(raw.phone) : null,
    p_address: raw.address ? String(raw.address) : null,
  })
  if (error) return { error: error.message }
  const result = (data ?? {}) as { error?: string | null }
  if (result.error) return { error: result.error }
  revalidatePath("/customers")
  return { error: null }
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("delete_customer_contact", {
    p_customer_id: id,
  })
  if (error) return { error: error.message }
  const result = (data ?? {}) as { error?: string | null }
  if (result.error) return { error: result.error }
  revalidatePath("/customers")
  return { error: null }
}
