"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Buka sesi kas baru dengan saldo awal laci. Menolak jika masih ada sesi terbuka.
export async function openShift(opening: number) {
  const supabase = await createClient()
  const open = Math.max(0, Math.round(opening || 0))
  if (!Number.isSafeInteger(open) || open > 2147483647) {
    return { error: "Saldo awal tidak valid" }
  }

  const { data, error } = await supabase.rpc("open_shift", { p_opening: open })
  if (error) return { error: error.message }
  const result = (data ?? {}) as { error?: string | null }
  if (result.error) return { error: result.error }

  revalidatePath("/shift")
  revalidatePath("/dashboard")
  return { error: null }
}

// Tutup sesi: hitung kas fisik (closing) vs perkiraan sistem (expected), simpan selisih.
export async function closeShift(id: string, closing: number, note?: string) {
  const supabase = await createClient()
  const close = Math.max(0, Math.round(closing || 0))
  if (!Number.isSafeInteger(close) || close > 2147483647) {
    return { error: "Saldo akhir tidak valid" }
  }
  const { data, error } = await supabase.rpc("close_shift", {
    p_id: id,
    p_closing: close,
    p_note: note?.trim() || null,
  })
  if (error) return { error: error.message }
  const result = (data ?? {}) as { error?: string | null }
  if (result.error) return { error: result.error }

  revalidatePath("/shift")
  revalidatePath("/dashboard")
  return { error: null }
}
