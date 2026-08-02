"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

// Mengunci halaman utama saat user login tapi tidak punya toko aktif.
// - Owner tanpa toko  -> diarahkan membuat toko baru (/stores/new).
// - Kasir tanpa toko  -> tokonya telah dihapus: beri tahu lalu auto-logout.
export function NoStoreGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.replace("/login")
        return
      }

      const { data: storeId } = await supabase.rpc("current_store_id")
      if (!active) return

      if (storeId) {
        setReady(true)
        return
      }

      // Tidak ada toko aktif. Bedakan kasir (punya store_code) vs owner.
      const isKasir = Boolean(user.user_metadata?.store_code)
      if (isKasir) {
        toast.error("Toko tempat Anda bekerja telah dihapus. Anda akan keluar.")
        await supabase.auth.signOut()
        router.replace("/login")
        return
      }

      router.replace("/stores/new")
    }

    check()
    return () => {
      active = false
    }
  }, [router])

  if (!ready) return null
  return <>{children}</>
}
