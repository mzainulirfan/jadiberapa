"use client"

import { useActionState, useEffect, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProduct, updateProduct, getCategories, createCategory, uploadProductImage } from "@/lib/actions/products"
import type { BxCategory, BxProduct } from "./types"
import { Plus, Trash, X } from "@/components/ui/icons"

type Props = {
  product?: BxProduct | null
  children: React.ReactNode
}

export function ProductDialog({ product, children }: Props) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const action = product ? updateProduct.bind(null, product.id) : createProduct

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      if (newCategory) {
        const { data, error } = await createCategory(newCategory)
        if (data) formData.set("category_id", data.id)
        if (error) return { error }
      }
      return action(formData)
    },
    { error: null }
  )

  useEffect(() => {
    if (open) {
      getCategories().then(setCategories)
      setImageUrl(product?.image_url ?? "")
    }
  }, [open])

  useEffect(() => {
    if (state?.error === null && !pending) setOpen(false)
  }, [state, pending])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const { url, error } = await uploadProductImage(fd)
    setUploading(false)
    e.target.value = ""
    if (url) setImageUrl(url)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={children as React.ReactElement} />
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <DrawerTitle className="text-lg font-bold">
            {product ? "Edit Barang" : "Tambah Barang"}
          </DrawerTitle>
          <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <input type="hidden" name="image_url" value={imageUrl} />
            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Gambar</p>
              <div className="flex items-center gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-canvas">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="Preview" className="size-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold text-ink-faint">
                      {product?.name?.charAt(0) ?? "?"}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink active:bg-canvas-soft">
                    {uploading ? "Mengunggah..." : "Unggah Gambar"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="flex items-center gap-1 text-xs text-destructive"
                    >
                      <Trash className="size-3.5" /> Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Informasi Barang</p>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Nama Barang</label>
                <Input name="name" placeholder="Contoh: Indomie Goreng" defaultValue={product?.name} required />
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Kategori</label>
                <div className="flex gap-2">
                  <select
                    name="category_id"
                    defaultValue={product?.category_id ?? ""}
                    className="flex h-9 w-full rounded-[4px] border border-hairline bg-canvas px-2.5 text-sm text-ink outline-none focus:border-primary"
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Baru"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Harga & Stok</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted mb-1 block">Harga Beli</label>
                  <Input name="price_buy" type="number" placeholder="0" defaultValue={product?.price_buy ?? ""} />
                </div>
                <div>
                  <label className="text-xs text-ink-muted mb-1 block">Harga Jual</label>
                  <Input name="price_sell" type="number" placeholder="0" defaultValue={product?.price_sell ?? ""} required />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Stok</label>
                <Input name="stock" type="number" placeholder="0" defaultValue={product?.stock ?? ""} />
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Identitas</p>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">SKU</label>
                <Input name="sku" placeholder="Kode SKU" defaultValue={product?.sku ?? ""} />
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Barcode</label>
                <Input name="barcode" placeholder="Opsional" defaultValue={product?.barcode ?? ""} />
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {state?.error && <p className="text-destructive text-sm mb-2">{state.error}</p>}
            <Button type="submit" className="w-full rounded-full h-11 text-base" disabled={pending}>
              {pending ? "Menyimpan..." : product ? "Simpan Perubahan" : "Tambah Barang"}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

