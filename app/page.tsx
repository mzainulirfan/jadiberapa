import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "Saberaha — Kasir online untuk warung & UMKM",
  description:
    "Aplikasi kasir untuk warung dan UMKM: catat jualan, stok, utang, dan laporan dari HP, bahkan saat offline.",
}

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")
  return <LandingPage />
}
