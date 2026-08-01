"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export type UserRole = "owner" | "kasir"

// Peran user di toko aktif (dari RPC current_user_role).
// undefined = masih memuat; null = belum punya toko aktif.
export function useRole(): UserRole | null | undefined {
  const [role, setRole] = useState<UserRole | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.rpc("current_user_role").then(({ data }) => {
      if (!active) return
      setRole((data as UserRole | null) ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  return role
}
