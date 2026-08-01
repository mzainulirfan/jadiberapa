"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getCategories, getCategoryProductCounts, invalidateCategories } from "@/lib/db/queries"
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/products"
import { Pencil, Trash, Plus, Tag } from "@/components/ui/icons"

type Cat = { id: string; name: string }

function CategoryForm({ category, onDone }: { category?: Cat | null; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    const res = category
      ? await updateCategory(category.id, trimmed)
      : await createCategory(trimmed)
    setPending(false)
    if (res.error) {
      const dup = /duplicate|unique/i.test(res.error)
      setError(dup ? "Nama kategori sudah dipakai" : res.error)
      return
    }
    invalidateCategories()
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="cat-name" className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <Tag className="size-3.5" /> Nama Kategori
        </label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Minuman"
          autoFocus
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={pending}>
        {pending ? "Menyimpan..." : category ? "Simpan" : "Tambah"}
      </Button>
    </form>
  )
}

export function CategoriesTab() {
  const [cats, setCats] = useState<Cat[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Cat | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cat | null>(null)

  async function load() {
    const [list, cnt] = await Promise.all([getCategories(), getCategoryProductCounts()])
    setCats(list)
    setCounts(cnt)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const [list, cnt] = await Promise.all([getCategories(), getCategoryProductCounts()])
      if (active) {
        setCats(list)
        setCounts(cnt)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const res = await deleteCategory(deleteTarget.id)
    if (res.error) {
      toast.error("Gagal menghapus kategori")
      return
    }
    invalidateCategories()
    setDeleteTarget(null)
    toast.success("Kategori dihapus")
    load()
  }

  const deleteCount = deleteTarget ? (counts[deleteTarget.id] ?? 0) : 0

  return (
    <div className="space-y-3">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setEdit(null)
        }}
      >
        <DialogTrigger
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground active:bg-primary-active"
          onClick={() => setEdit(null)}
        >
          <Plus className="size-4" /> Tambah Kategori
        </DialogTrigger>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
            <DialogDescription>
              Kelompokkan barang agar mudah ditemukan dan dilaporkan.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            category={edit}
            onDone={() => {
              setOpen(false)
              setEdit(null)
              toast.success(edit ? "Kategori diperbarui" : "Kategori ditambahkan")
              load()
            }}
          />
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
            >
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 flex-1 rounded-full" />
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <Skeleton className="size-8 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      ) : cats.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Belum ada kategori</p>
      ) : (
        <div className="space-y-2">
          {cats.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
            >
              <Tag className="size-4 shrink-0 text-ink-muted" />
              <span className="flex-1 truncate text-sm font-medium text-ink">{c.name}</span>
              <span className="shrink-0 rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] text-ink-muted">
                {counts[c.id] ?? 0} barang
              </span>
              <button
                onClick={() => {
                  setEdit(c)
                  setOpen(true)
                }}
                aria-label={`Edit ${c.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(c)}
                aria-label={`Hapus ${c.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
              >
                <Trash className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Kategori?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; akan dihapus permanen dan tidak bisa dikembalikan.
              {deleteCount > 0
                ? ` ${deleteCount} barang di kategori ini akan menjadi tanpa kategori.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
