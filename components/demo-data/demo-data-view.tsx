"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, Package, Star, Check } from "@/components/ui/icons"
import { generateDemoData } from "@/lib/actions/demo-data"
import { wipeAllData } from "@/lib/actions/reset-data"

type State = {
  error: string | null
  counts: {
    categories: number
    products: number
    transactions: number
  } | null
}

type ResetState = {
  error: string | null
  deletedStores: number
  deletedUsers: number
}

const initialState: State = { error: null, counts: null }
const initialResetState: ResetState = { error: null, deletedStores: 0, deletedUsers: 0 }

export function DemoDataView() {
  const [state, formAction, pending] = useActionState(async (_prev: State, _fd: FormData): Promise<State> => {
    const res = await generateDemoData()
    if (res.error) {
      toast.error(res.error)
      return { error: res.error, counts: null }
    }
    toast.success("Data demo berhasil dibuat")
    return { error: null, counts: res.counts }
  }, initialState)

  const [resetState, resetAction, resetPending] = useActionState(
    async (_prev: ResetState, fd: FormData): Promise<ResetState> => {
      const res = await wipeAllData(fd)
      if (res.error) {
        toast.error(res.error)
        return { error: res.error, deletedStores: 0, deletedUsers: 0 }
      }
      toast.success("Semua data berhasil dihapus")
      window.location.replace("/login")
      return { error: null, deletedStores: res.deletedStores, deletedUsers: res.deletedUsers }
    },
    initialResetState
  )

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Data Demo</p>
            <p className="text-xs text-ink-faint">Reset data toko aktif lalu isi contoh data besar.</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            <p className="font-semibold">Peringatan</p>
          </div>
          <p className="mt-2 leading-5 text-amber-900/80">
            Aksi ini menghapus kategori, barang, transaksi, utang, pengeluaran, diskon, varian, dan stok toko aktif.
            Jalankan hanya untuk demo atau stress test.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <p className="text-xs text-ink-muted">Kategori</p>
          <p className="mt-1 text-2xl font-bold text-ink">200</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <p className="text-xs text-ink-muted">Produk</p>
          <p className="mt-1 text-2xl font-bold text-ink">1000</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <p className="text-xs text-ink-muted">Transaksi</p>
          <p className="mt-1 text-2xl font-bold text-ink">2000</p>
        </div>
      </div>

      <form action={formAction} className="space-y-3 rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Star className="size-4" />
          <span>Generate data demo sekali jalan</span>
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.counts && (
          <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 p-3 text-sm text-ink">
            <div className="flex items-center gap-2 text-accent-green">
              <Check className="size-4" />
              <p className="font-semibold">Selesai</p>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Dibuat {state.counts.categories} kategori, {state.counts.products} produk, dan {state.counts.transactions} transaksi.
            </p>
          </div>
        )}
        <Button type="submit" className="w-full rounded-full" variant="destructive" disabled={pending}>
          {pending ? "Membuat data..." : "Generate Data Demo"}
        </Button>
      </form>

      <form action={resetAction} className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span>Hapus semua data dan akun</span>
        </div>
        <p className="text-xs leading-5 text-ink-muted">
          Ini akan menghapus semua toko, kategori, produk, pembeli, transaksi, pegawai, owner, dan akun auth dummy.
        </p>
        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-xs text-ink-muted">
            Ketik HAPUS SEMUA untuk lanjut
          </label>
          <Input id="reset-confirm" name="confirm" placeholder="HAPUS SEMUA" autoComplete="off" required />
        </div>
        {resetState.error && <p className="text-sm text-destructive">{resetState.error}</p>}
        {resetState.deletedUsers > 0 && (
          <p className="text-xs text-ink-muted">
            Terhapus {resetState.deletedStores} toko dan {resetState.deletedUsers} akun.
          </p>
        )}
        <Button type="submit" className="w-full rounded-full" variant="destructive" disabled={resetPending}>
          {resetPending ? "Menghapus semua..." : "Hapus Semua Data"}
        </Button>
      </form>
    </div>
  )
}
