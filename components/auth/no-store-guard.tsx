"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Store, Refresh, XCircle } from "@/components/ui/icons"
import { deleteAccount } from "@/lib/actions/auth"

// Mengunci halaman utama saat user login tapi tidak punya toko aktif.
// - Owner tanpa toko -> modal pilihan: "Buat Toko" atau "Keluar".
// - Kasir pending (belum disetujui pemilik) -> layar "Menunggu Persetujuan".
// - Kasir yang sudah diberhentikan -> modal: "Buat Toko" atau "Hapus Akun".
type Status = "loading" | "ready" | "no-store" | "pending" | "removed"

export function NoStoreGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")
  const [retry, setRetry] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

      // Belum punya toko aktif. Cek dulu apakah ada permintaan gabung yang pending.
      const { data: pending } = await supabase
        .from("store_members")
        .select("store_id")
        .eq("user_id", user.id)
        .eq("approved", false)
        .limit(1)
        .maybeSingle()
      if (!active) return

      if (pending) {
        setStatus("pending")
        return
      }

      // Tidak ada keanggotaan sama sekali. Kasir yang terdaftar via kode toko
      // namun sudah tidak punya akses = telah diberhentikan / tokonya dihapus.
      if (user.user_metadata?.store_code) {
        setStatus("removed")
        return
      }

      setStatus("no-store")
    }

    check()
    return () => {
      active = false
    }
  }, [router, retry])

  async function handleLogout() {
    await createClient().auth.signOut()
    router.replace("/login")
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    const res = await deleteAccount()
    if (res?.error) {
      setDeleting(false)
      toast.error(res.error)
      return
    }
    await createClient().auth.signOut()
    router.replace("/login")
  }

  if (status === "ready") return <>{children}</>
  if (status !== "no-store" && status !== "pending" && status !== "removed") return null

  if (status === "removed") {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas-soft/95 p-4">
        <div className="w-full max-w-sm rounded-[20px] border border-hairline bg-canvas p-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-[-0.3px] text-ink">Anda tidak punya akses ke toko ini</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Akun Anda sudah diberhentikan dari toko oleh pemilik. Anda bisa membuat toko sendiri,
            atau menghapus akun ini.
          </p>
          {!confirmDelete ? (
            <div className="mt-5 space-y-2">
              <Button className="w-full" onClick={() => router.push("/stores/new")}>
                Buat Toko
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setConfirmDelete(true)}>
                Hapus Akun
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              <p className="text-xs leading-relaxed text-ink-faint">
                Akun dan seluruh datanya akan dihapus permanen. Tidak bisa dibatalkan.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Batal
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (status === "pending") {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas-soft/95 p-4">
        <div className="w-full max-w-sm rounded-[20px] border border-hairline bg-canvas p-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Refresh className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-[-0.3px] text-ink">Menunggu Persetujuan</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Permintaan Anda bergabung sebagai kasir belum disetujui pemilik toko. Setelah disetujui,
            Anda bisa langsung masuk. Muat ulang halaman ini sesekali untuk memeriksa statusnya.
          </p>
          <div className="mt-5 space-y-2">
            <Button className="w-full" onClick={() => setRetry((r) => r + 1)}>
              Muat Ulang
            </Button>
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              Keluar
            </Button>
          </div>
        </div>
      </div>
    )
  }

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
