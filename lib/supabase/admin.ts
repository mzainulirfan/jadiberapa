import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Client ber-peran service role: HANYA untuk operasi admin Supabase Auth yang
// tidak bisa dilakukan lewat sesi pengguna (mis. reset passcode kasir oleh owner).
// Tidak boleh diekspos ke client; hanya dipakai di server action.
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
