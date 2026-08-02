"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash } from "@/components/ui/icons"
import {
  getStoreDeletionStats,
  invalidateAllDataCaches,
  setActiveStore,
  type StoreDeletionStats,
} from "@/lib/db/queries"
import { deleteCurrentStore } from "@/lib/actions/stores"

export function DangerZone({ storeName }: { storeName: string }) {
  const [stats, setStats] = useState<StoreDeletionStats | null>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    getStoreDeletionStats().then((s) => {
      if (active) setStats(s)
    })
    return () => {
      active = false
    }
  }, [])

  function reset() {
    setStep(1)
    setAcknowledged(false)
    setConfirmName("")
  }

  function closeDialog() {
    if (deleting) return
    setOpen(false)
    reset()
  }

  async function handleDelete() {
    if (confirmName.trim() !== storeName.trim()) {
      toast.error("Nama toko tidak cocok")
      return
    }
    setDeleting(true)
    const res = await deleteCurrentStore(confirmName.trim())
    if (res.error) {
      toast.error(res.error)
      setDeleting(false)
      return
    }

    invalidateAllDataCaches()

    if ((res.remaining ?? 0) > 0 && res.nextStoreId) {
      await setActiveStore(res.nextStoreId)
      toast.success(`Toko "${res.deletedName}" dihapus`)
      window.location.assign("/dashboard")
      return
    }

    toast.success(`Toko "${res.deletedName}" dihapus`)
    window.location.assign("/stores/new")
  }

  const nameMatches = confirmName.trim() === storeName.trim()

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-destructive">Zona Berbahaya</h2>
          <p className="text-xs text-ink-muted">Menghapus toko bersifat permanen dan tidak dapat dibatalkan.</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-hairline bg-canvas p-3">
        {stats === null ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="h-3 w-56 rounded-full" />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">{storeName}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {stats.products} barang · {stats.categories} kategori · {stats.customers} pembeli ·{" "}
              {stats.transactions} transaksi
            </p>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Semua data toko ini akan terhapus permanen dan tidak dapat dipulihkan kecuali dari backup.
      </p>
      <Link href="/backup" className="mt-1 inline-block text-xs font-semibold text-primary">
        Unduh Backup dulu →
      </Link>

      <Button
        type="button"
        variant="destructive"
        className="mt-4 w-full"
        onClick={() => {
          setOpen(true)
          reset()
        }}
      >
        <Trash className="size-4" /> Hapus Toko…
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent>
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle>Hapus toko ini?</DialogTitle>
                <DialogDescription>
                  Toko <span className="font-semibold text-ink">{storeName}</span> beserta seluruh
                  barang, kategori, pembeli, transaksi, dan pengaturannya akan dihapus permanen.
                </DialogDescription>
              </DialogHeader>

              <label className="flex items-start gap-2.5 rounded-lg border border-hairline bg-canvas-soft p-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 size-4 accent-destructive"
                />
                <span>Saya paham data ini tidak dapat dipulihkan kecuali dari backup.</span>
              </label>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!acknowledged}
                  onClick={() => setStep(2)}
                >
                  Lanjut
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Konfirmasi penghapusan</DialogTitle>
                <DialogDescription>
                  Ketik nama toko <span className="font-semibold text-ink">{storeName}</span> secara
                  persis untuk mengonfirmasi.
                </DialogDescription>
              </DialogHeader>

              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={storeName}
                autoFocus
                autoComplete="off"
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={deleting}>
                  Kembali
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!nameMatches || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Menghapus…" : "Hapus Toko Permanen"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
