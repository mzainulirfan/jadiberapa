"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Store } from "@/components/ui/icons"

// Mengunci halaman utama saat user login tapi tidak punya toko aktif.
// - Owner tanpa toko -> modal pilihan: "Buat Toko" atau "Keluar".
// - Kasir tanpa toko -> tokonya telah dihapus: beri tahu lalu auto-logout.
type Status = "loading" | "ready" | "no-store"

export function NoStoreGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")

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
        setStatus("ready")
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

      setStatus("no-store")
    }

    check()
    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await createClient().auth.signOut()
    router.replace("/login")
  }

  if (status === "ready") return <>{children}</>
  if (status !== "no-store") return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas-soft/95 p-4">
      <div className="w-full max-w-sm rounded-[20px] border border-hairline bg-canvas p-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Store className="size-6" />
        </span>
        <h2 className="mt-4 text-lg font-bold tracking-[-0.3px] text-ink">Belum punya toko</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Akun Anda belum terhubung ke toko mana pun. Buat toko untuk mulai berjualan, atau keluar
          dari akun ini.
        </p>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={() => router.push("/stores/new")}>
            Buat Toko
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Keluar
          </Button>
        </div>
      </div>
    </div>
  )
}
