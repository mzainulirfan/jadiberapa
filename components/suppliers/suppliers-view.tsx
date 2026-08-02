"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getSuppliers, getSupplierDebts, invalidateSuppliers, type BxSupplier } from "@/lib/db/queries"
import { createSupplier, updateSupplier, deleteSupplier } from "@/lib/actions/purchases"
import { Plus, Search, Trash, Pencil, X, Store } from "@/components/ui/icons"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

type FormState = { name: string; phone: string; note: string }

const EMPTY_FORM: FormState = { name: "", phone: "", note: "" }

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<BxSupplier[] | null>(null)
  const [debts, setDebts] = useState<{ supplier_id: string | null; remaining: number }[]>([])
  const [search, setSearch] = useState("")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<BxSupplier | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BxSupplier | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getSuppliers(), getSupplierDebts()]).then(([list, debtList]) => {
      if (!active) return
      setSuppliers(list)
      setDebts(
        debtList.map((d) => ({ supplier_id: d.supplier_id, remaining: Math.max(0, d.total - d.paid_amount) }))
      )
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s || !suppliers) return suppliers ?? []
    return suppliers.filter((sup) => sup.name.toLowerCase().includes(s))
  }, [suppliers, search])

  const debtBySupplier = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of debts) {
      if (!d.supplier_id) continue
      map.set(d.supplier_id, (map.get(d.supplier_id) ?? 0) + d.remaining)
    }
    return map
  }, [debts])

  const totalDebt = useMemo(() => [...debtBySupplier.values()].reduce((s, v) => s + v, 0), [debtBySupplier])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  function openEdit(sup: BxSupplier) {
    setEditing(sup)
    setForm({ name: sup.name, phone: sup.phone ?? "", note: sup.note ?? "" })
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nama supplier wajib diisi")
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await updateSupplier(editing.id, form.name, form.phone, form.note)
        : await createSupplier(form.name, form.phone, form.note)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? "Supplier diperbarui" : "Supplier ditambahkan")
      setDrawerOpen(false)
      invalidateSuppliers()
      const list = await getSuppliers()
      setSuppliers(list)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const res = await deleteSupplier(id)
    if (res?.error) {
      toast.error("Gagal menghapus")
      return
    }
    invalidateSuppliers()
    setSuppliers((prev) => (prev ?? []).filter((s) => s.id !== id))
    toast.success("Supplier dihapus")
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <Search className="size-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari supplier"
            className="h-9 w-full rounded-full border border-hairline bg-canvas pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary/50 active:bg-canvas-soft"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      </div>

      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-orange/10 text-accent-orange">
            <Store className="size-4" />
          </span>
          <p className="text-sm font-medium text-ink-muted">Utang ke Supplier</p>
        </div>
        {suppliers === null ? (
          <Skeleton className="mt-3 h-8 w-40 rounded-md" />
        ) : (
          <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-destructive">
            {fmtRp(totalDebt)}
          </p>
        )}
        {suppliers !== null && (
          <p className="mt-2 text-xs text-ink-faint">
            {suppliers.length} supplier · {debtBySupplier.size} berutang
          </p>
        )}
      </div>

      {suppliers === null ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-32 rounded-full" />
              </div>
              <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-muted">{search ? "Supplier tidak ditemukan" : "Belum ada supplier"}</p>
          {!search && (
            <p className="mt-1 text-xs text-ink-faint">Tambahkan pemasok agar pembelian tercatat rapi.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          {filtered.map((s) => {
            const debt = debtBySupplier.get(s.id) ?? 0
            return (
              <div key={s.id} className="flex items-center gap-3 p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas-soft text-sm font-bold text-ink-muted">
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {s.phone ? s.phone : s.note ? s.note : "Tidak ada kontak"}
                    {debt > 0 && (
                      <span className="font-medium text-destructive"> · utang {fmtRp(debt)}</span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/purchases?supplier=${s.id}`}
                  className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors active:bg-primary/20"
                >
                  Beli
                </Link>
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  aria-label="Ubah supplier"
                  className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  aria-label="Hapus supplier"
                  className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={(o) => !saving && setDrawerOpen(o)} showSwipeHandle>
        <DrawerContent className="rounded-t-xl">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
            <DrawerTitle>{editing ? "Ubah Supplier" : "Tambah Supplier"}</DrawerTitle>
            <DrawerClose className="-mr-1.5 rounded-full p-1.5 text-ink-muted active:bg-canvas-soft">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label htmlFor="sup-name" className="mb-1 block text-xs text-ink-muted">Nama</label>
                <Input
                  id="sup-name"
                  placeholder="Contoh: PT Sumber Makmur"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="sup-phone" className="mb-1 block text-xs text-ink-muted">
                  Telepon <span className="text-ink-faint">(opsional)</span>
                </label>
                <Input
                  id="sup-phone"
                  inputMode="tel"
                  placeholder="Contoh: 081234567890"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="sup-note" className="mb-1 block text-xs text-ink-muted">
                  Catatan <span className="text-ink-faint">(opsional)</span>
                </label>
                <Input
                  id="sup-note"
                  placeholder="Contoh: Grosir sembako, kirim tiap Senin"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                className="h-11 w-full rounded-full text-base"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Supplier"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Supplier?</DialogTitle>
            <DialogDescription>
              Supplier &quot;{deleteTarget?.name}&quot; akan dihapus. Riwayat pembelian yang sudah tercatat
              tetap tersimpan, tetapi nama supplier tidak lagi ditampilkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
