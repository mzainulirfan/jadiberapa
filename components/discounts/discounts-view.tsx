"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DiscountDialog } from "./discount-dialog"
import {
  getDiscounts,
  invalidateDiscounts,
  type BxDiscount,
} from "@/lib/db/queries"
import { deleteDiscount, toggleDiscount } from "@/lib/actions/discounts"
import { Pencil, Plus, Trash, Tag, CheckCircle, XCircle } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart/cart-provider"

const typeLabel: Record<BxDiscount["type"], string> = {
  product: "Produk",
  category: "Kategori",
  global: "Semua Barang",
}

function valueLabel(d: BxDiscount) {
  return d.value_type === "percent" ? `${d.value}%` : `Rp${d.value.toLocaleString("id-ID")}`
}

export function DiscountsView() {
  const { reloadDiscounts } = useCart()
  const [discounts, setDiscounts] = useState<BxDiscount[] | null>(null)
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; discount: BxDiscount }
  >({ mode: "create" })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BxDiscount | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    invalidateDiscounts()
    getDiscounts().then(setDiscounts)
    reloadDiscounts()
  }

  useEffect(() => {
    getDiscounts().then(setDiscounts)
  }, [])

  async function handleToggle(d: BxDiscount) {
    const next = !d.active
    setDiscounts((prev) =>
      prev ? prev.map((x) => (x.id === d.id ? { ...x, active: next } : x)) : prev
    )
    const { error } = await toggleDiscount(d.id, next)
    if (error) {
      toast.error(error)
      reload()
      return
    }
    invalidateDiscounts()
    reloadDiscounts()
    toast.success(next ? "Diskon aktif" : "Diskon nonaktif")
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deleteDiscount(deleteTarget.id)
    setDeleting(false)
    if (error) {
      toast.error(error)
      setDeleteTarget(null)
      return
    }
    setDeleteTarget(null)
    reload()
    toast.success("Diskon dihapus")
  }

  function openCreate() {
    setEditing({ mode: "create" })
    setDialogOpen(true)
  }

  function openEdit(d: BxDiscount) {
    setEditing({ mode: "edit", discount: d })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4 p-4">
      <Button onClick={openCreate} className="w-full rounded-full h-11 text-base gap-1.5">
        <Plus className="size-4" />
        Tambah Diskon
      </Button>

      {discounts === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-36 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-24 rounded-full" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : discounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-canvas p-6 text-center">
          <Tag className="mx-auto size-8 text-ink-faint" />
          <p className="mt-2 text-sm font-medium text-ink">Belum ada diskon</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Buat diskon per produk, kategori, atau untuk semua barang.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.map((d) => (
            <div key={d.id} className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="truncate">{d.name}</span>
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-full",
                        d.active ? "text-accent-green" : "text-ink-faint"
                      )}
                    >
                      {d.active ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{typeLabel[d.type]}</Badge>
                    <Badge variant="outline" className="border-accent-orange/30 bg-accent-orange/10 text-accent-orange">
                      {valueLabel(d)}
                    </Badge>
                    {d.type !== "global" && (
                      <span className="text-xs text-ink-faint">{d.product_ids.length} produk</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.active}
                  onClick={() => handleToggle(d)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    d.active ? "bg-primary" : "bg-ink/20"
                  )}
                  aria-label={`${d.active ? "Nonaktifkan" : "Aktifkan"} ${d.name}`}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      d.active && "translate-x-5"
                    )}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-hairline pt-2">
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEdit(d)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={() => setDeleteTarget(d)}
                >
                  <Trash className="size-3.5" />
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DiscountDialog
        discount={editing.mode === "edit" ? editing.discount : null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Diskon?</DialogTitle>
            <DialogDescription>
              Diskon “{deleteTarget?.name}” akan dihapus dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
