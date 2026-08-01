"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useRole } from "@/lib/hooks/use-role"

// Mengunci halaman yang hanya boleh diakses pemilik toko. Kasir dialihkan ke
// dashboard; selama peran belum dimuat (atau user tanpa toko) tidak dirender.
export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const role = useRole()
  const router = useRouter()

  useEffect(() => {
    if (role === "kasir" || role === null) router.replace("/dashboard")
  }, [role, router])

  if (role !== "owner") return null
  return <>{children}</>
}
