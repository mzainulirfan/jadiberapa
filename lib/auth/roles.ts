import { createClient } from "@/lib/supabase/server"

// Peran user di toko aktif, dibaca langsung dari DB (bukan asumsi client).
export async function currentRole(): Promise<"owner" | "kasir" | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc("current_user_role")
  return (data as "owner" | "kasir" | null) ?? null
}

export async function isOwner(): Promise<boolean> {
  return (await currentRole()) === "owner"
}
