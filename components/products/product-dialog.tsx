"use client"

import { useActionState, useEffect, useRef, useState } from "react"
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
import { createProduct, updateProduct, createCategory, uploadProductImage } from "@/lib/actions/products"
import { getCategories, invalidateCategories } from "@/lib/db/queries"
import type { BxCategory, BxProduct } from "./types"
import { Trash, X, Plus } from "@/components/ui/icons"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type Props = {
  product?: BxProduct | null
  children: React.ReactNode
  onSaved?: () => void
}

export function ProductDialog({ product, children, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [priceBuy, setPriceBuy] = useState(product?.price_buy ? String(product.price_buy) : "")
  const [priceSell, setPriceSell] = useState(product?.price_sell ? String(product.price_sell) : "")
  const action = product ? updateProduct.bind(null, product.id) : createProduct
  const submittedRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      submittedRef.current = true
      if (newCategory) {
        const { data, error } = await createCategory(newCategory)
        if (data) {
          formData.set("category_id", data.id)
          invalidateCategories()
          getCategories().then(setCategories)
        }
        if (error) return { error }
      }
      return action(formData)
    },
    { error: null }
  )

  useEffect(() => {
    if (open) {
      getCategories().then(setCategories)
    }
  }, [open])

  useEffect(() => {
    if (state?.error === null && !pending && submittedRef.current) {
      submittedRef.current = false
      setOpen(false)
      onSavedRef.current?.()
    }
  }, [state, pending])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const { url } = await uploadProductImage(fd)
    setUploading(false)
    e.target.value = ""
    if (url) setImageUrl(url)
  }

  const buy = Number(priceBuy) || 0
  const sell = Number(priceSell) || 0
  const marginRp = sell - buy
  const marginPct = buy > 0 ? (marginRp / buy) * 100 : null

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setImageUrl(product?.image_url ?? "")
          setAddingCategory(false)
          setNewCategory("")
          setPriceBuy(product?.price_buy ? String(product.price_buy) : "")
          setPriceSell(product?.price_sell ? String(product.price_sell) : "")
        }
      }}
      showSwipeHandle
    >
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
                <label htmlFor="name" className="text-xs text-ink-muted mb-1 block">Nama Barang</label>
                <Input id="name" name="name" placeholder="Contoh: Indomie Goreng" defaultValue={product?.name} required />
              </div>
              <div>
                <label htmlFor="category_id" className="text-xs text-ink-muted mb-1 block">Kategori</label>
                {addingCategory ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Nama kategori baru"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCategory(false)
                        setNewCategory("")
                      }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-ink-muted active:bg-canvas"
                      aria-label="Batal kategori baru"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      id="category_id"
                      name="category_id"
                      defaultValue={product?.category_id ?? ""}
                      className="h-8 flex-1 rounded-lg border border-hairline bg-canvas px-2.5 text-sm text-ink outline-none focus:border-primary"
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddingCategory(true)}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-hairline px-3 text-xs font-medium text-ink active:bg-canvas"
                    >
                      <Plus className="size-3.5" /> Baru
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Harga & Stok</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="price_buy" className="text-xs text-ink-muted mb-1 block">Harga Beli</label>
                  <InputGroup className="bg-canvas">
                    <InputGroupAddon>Rp</InputGroupAddon>
                    <InputGroupInput
                      id="price_buy"
                      name="price_buy"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder="0"
                      value={priceBuy}
                      onChange={(e) => setPriceBuy(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div>
                  <label htmlFor="price_sell" className="text-xs text-ink-muted mb-1 block">Harga Jual</label>
                  <InputGroup className="bg-canvas">
                    <InputGroupAddon>Rp</InputGroupAddon>
                    <InputGroupInput
                      id="price_sell"
                      name="price_sell"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder="0"
                      value={priceSell}
                      onChange={(e) => setPriceSell(e.target.value)}
                      required
                    />
                  </InputGroup>
                </div>
              </div>
              {priceSell !== "" && (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                    marginRp < 0 ? "bg-destructive/10 text-destructive" : "bg-canvas text-ink-muted"
                  )}
                >
                  <span>{marginRp < 0 ? "Harga jual di bawah modal" : "Margin per item"}</span>
                  <span className="font-semibold">
                    Rp{marginRp.toLocaleString("id-ID")}
                    {marginPct !== null ? ` · ${Math.round(marginPct)}%` : ""}
                  </span>
                </div>
              )}
              <div>
                <label htmlFor="stock" className="text-xs text-ink-muted mb-1 block">Stok</label>
                <Input id="stock" name="stock" type="number" inputMode="numeric" min="0" placeholder="0" defaultValue={product?.stock ?? ""} />
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Identitas</p>
              <div>
                <label htmlFor="sku" className="text-xs text-ink-muted mb-1 block">SKU</label>
                <Input id="sku" name="sku" placeholder="Kode SKU" defaultValue={product?.sku ?? ""} />
              </div>
              <div>
                <label htmlFor="barcode" className="text-xs text-ink-muted mb-1 block">Barcode</label>
                <Input id="barcode" name="barcode" placeholder="Opsional" defaultValue={product?.barcode ?? ""} />
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

