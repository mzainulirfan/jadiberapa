import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Client service role untuk operasi server yang tidak dapat dijalankan lewat
// sesi user, seperti Auth admin dan RPC privileged setelah re-authentication.
// Tidak boleh diekspos ke client; hanya dipakai di server action.
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
