"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Buka sesi kas baru dengan saldo awal laci. Menolak jika masih ada sesi terbuka.
export async function openShift(opening: number) {
  const supabase = await createClient()
  const open = Math.max(0, Math.round(opening || 0))

  const { data: active } = await supabase
    .from("cash_sessions")
    .select("id")
    .is("closed_at", null)
    .limit(1)
    .maybeSingle()
  if (active) return { error: "Masih ada shift yang terbuka." }

  const { error } = await supabase.from("cash_sessions").insert({ opening: open })
  if (error) return { error: error.message }

  revalidatePath("/shift")
  revalidatePath("/dashboard")
  return { error: null }
}

// Tutup sesi: hitung kas fisik (closing) vs perkiraan sistem (expected), simpan selisih.
export async function closeShift(id: string, closing: number, note?: string) {
  const supabase = await createClient()

  const { data: session, error: getErr } = await supabase
    .from("cash_sessions")
    .select("id, opening, opened_at, closed_at")
    .eq("id", id)
    .single()
  if (getErr) return { error: getErr.message }
  if (!session) return { error: "Shift tidak ditemukan." }
  if (session.closed_at) return { error: "Shift sudah ditutup." }

  const { data: summary } = await supabase.rpc("get_shift_summary", {
    p_opened_at: session.opened_at,
  })
  const cashSales = (summary as { cashSales?: number } | null)?.cashSales ?? 0
  const expected = (session.opening as number) + cashSales
  const close = Math.max(0, Math.round(closing || 0))
  const diff = close - expected

  const { error } = await supabase
    .from("cash_sessions")
    .update({
      closing: close,
      expected,
      diff,
      note: note?.trim() || null,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/shift")
  revalidatePath("/dashboard")
  return { error: null }
}
