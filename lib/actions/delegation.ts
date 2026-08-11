"use server"

import { createClient as createIsolatedClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type RpcResult = {
  error?: string | null
  delegation_id?: string
  ended?: boolean
}

function validPasscode(passcode: string) {
  return /^\d{6}$/.test(passcode)
}

async function authenticatedOwner() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub || !claims.email || !claims.session_id) return null

  return {
    userId: String(claims.sub),
    email: String(claims.email),
    sessionId: String(claims.session_id),
  }
}

async function verifyPasscode(email: string, passcode: string) {
  if (!validPasscode(passcode)) return false

  // Isolated auth state verifies the password without replacing browser cookies.
  const verifier = createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
  const { error } = await verifier.auth.signInWithPassword({ email, password: passcode })
  return !error
}

export async function startCashierDelegation(cashierUserId: string, ownerPasscode: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cashierUserId)) {
    return { error: "Kasir tujuan tidak valid." }
  }

  const owner = await authenticatedOwner()
  if (!owner) return { error: "Sesi tidak ditemukan. Silakan masuk ulang." }
  if (!(await verifyPasscode(owner.email, ownerPasscode))) {
    return { error: "Passcode owner salah." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("start_cashier_delegation_for_session", {
    p_owner_user_id: owner.userId,
    p_session_id: owner.sessionId,
    p_cashier_user_id: cashierUserId,
  })
  if (error) return { error: error.message }

  const result = (data ?? {}) as RpcResult
  if (result.error || !result.delegation_id) {
    return { error: result.error ?? "Gagal memulai mode kasir." }
  }

  revalidatePath("/", "layout")
  return { error: null }
}

export async function endCashierDelegation(ownerPasscode: string) {
  const owner = await authenticatedOwner()
  if (!owner) return { error: "Sesi tidak ditemukan. Silakan masuk ulang." }
  if (!(await verifyPasscode(owner.email, ownerPasscode))) {
    return { error: "Passcode owner salah." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("end_cashier_delegation_for_session", {
    p_owner_user_id: owner.userId,
    p_session_id: owner.sessionId,
  })
  if (error) return { error: error.message }

  const result = (data ?? {}) as RpcResult
  if (result.error) return { error: result.error }

  revalidatePath("/", "layout")
  return { error: null }
}
