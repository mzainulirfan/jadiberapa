"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createProduct, updateProduct, uploadProductImage } from "@/lib/actions/products"
import { getCategories } from "@/lib/db/queries"
import type { BxCategory, BxProduct } from "./types"
import { Trash, X, Camera } from "@/components/ui/icons"
import { toast } from "sonner"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { BarcodeScanner } from "@/components/cashier/barcode-scanner"
import { PhotoCapture } from "./photo-capture"
import { cn } from "@/lib/utils"

const formatThousands = (raw: string) => (raw ? Number(raw).toLocaleString("id-ID") : "")
const onlyDigits = (s: string) => s.replace(/\D/g, "")

type Props = {
  product?: BxProduct | null
  children?: React.ReactNode
  onSaved?: () => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
  initialBarcode?: string
}

export function ProductDialog({
  product,
  children,
  onSaved,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  initialBarcode,
}: Props) {
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setOpenState(v)
      onOpenChangeProp?.(v)
    },
    [isControlled, onOpenChangeProp]
  )
  const [barcode, setBarcode] = useState(product?.barcode ?? "")
  const [scanOpen, setScanOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "")
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [priceBuy, setPriceBuy] = useState(product?.price_buy ? String(product.price_buy) : "")
  const [priceSell, setPriceSell] = useState(product?.price_sell ? String(product.price_sell) : "")
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price_sell?: string }>({})
  const action = product ? updateProduct.bind(null, product.id) : createProduct
  const submittedRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      // Validasi sendiri (form pakai noValidate) agar pesan seragam dgn UI app.
      const name = String(formData.get("name") ?? "").trim()
      const priceSellRaw = String(formData.get("price_sell") ?? "").trim()
      const errs: { name?: string; price_sell?: string } = {}
      if (!name) errs.name = "Nama barang wajib diisi."
      if (!priceSellRaw || Number(priceSellRaw) <= 0) errs.price_sell = "Harga jual harus lebih dari 0."
      setFieldErrors(errs)
      if (errs.name || errs.price_sell) return { error: null }
      submittedRef.current = true
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
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron nilai awal barcode saat drawer dibuka
    setBarcode(initialBarcode ?? product?.barcode ?? "")
  }, [open, initialBarcode, product])

  useEffect(() => {
    if (state?.error === null && !pending && submittedRef.current) {
      submittedRef.current = false
      setOpen(false)
      onSavedRef.current?.()
    }
  }, [state, pending, setOpen])

  async function processImage(file: File): Promise<File> {
    // Kecilkan sisi terpanjang ke maks 1280px & kompres JPEG agar hemat storage/bandwidth.
    const MAX_DIM = 1280
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions)
      const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0, w, h)
      bitmap.close?.()
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82))
      if (!blob) return file
      return new File([blob], "photo.jpg", { type: "image/jpeg" })
    } catch {
      return file
    }
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 8MB.")
      return
    }
    setUploading(true)
    try {
      const processed = await processImage(file)
      const fd = new FormData()
      fd.append("file", processed)
      const { url, error } = await uploadProductImage(fd)
      if (error) toast.error(error)
      else if (url) {
        setImageUrl(url)
        setDirty(true)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) await uploadFile(file)
  }

  const buy = Number(priceBuy) || 0
  const sell = Number(priceSell) || 0
  const marginRp = sell - buy
  const marginPct = buy > 0 ? (marginRp / buy) * 100 : null

  return (
    <>
    <Drawer
      open={open}
      modal={!scanOpen && !photoOpen}
      onOpenChange={(v) => {
        if (v) {
          setOpen(true)
          setImageUrl(product?.image_url ?? "")
          setCategoryId(product?.category_id ?? "")
          setPriceBuy(product?.price_buy ? String(product.price_buy) : "")
          setPriceSell(product?.price_sell ? String(product.price_sell) : "")
          setDirty(false)
          setFieldErrors({})
          return
        }
        // Menutup: konfirmasi dulu bila ada perubahan belum disimpan.
        if (dirty) {
          setDiscardOpen(true)
          return
        }
        setOpen(false)
      }}
      showSwipeHandle
    >
      {children ? <DrawerTrigger render={children as React.ReactElement} /> : null}
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <DrawerTitle className="text-lg font-bold">
            {product ? "Edit Barang" : "Tambah Barang"}
          </DrawerTitle>
          <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <form
          action={formAction}
          noValidate
          onChange={() => {
            setDirty(true)
            setFieldErrors((e) => (e.name || e.price_sell ? {} : e))
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
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
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPhotoOpen(true)}
                      disabled={uploading}
                      className="flex w-fit items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink active:bg-canvas-soft disabled:opacity-50"
                    >
                      <Camera className="size-3.5" /> Ambil Foto
                    </button>
                    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink active:bg-canvas-soft">
                      Unggah Gambar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {uploading && <p className="text-xs text-ink-muted">Mengunggah...</p>}
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="flex items-center gap-1 text-xs text-destructive"
                    >
                      <Trash className="size-3.5" /> Hapus
                    </button>
                  )}
                  <p className="text-xs text-ink-faint">Maks 8MB · otomatis dikecilkan ke 1280px</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Informasi Barang</p>
              <div>
                <label htmlFor="name" className="text-xs text-ink-muted mb-1 block">Nama Barang</label>
                <Input id="name" name="name" placeholder="Contoh: Indomie Goreng" defaultValue={product?.name} aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="category_id" className="text-xs text-ink-muted mb-1 block">Kategori</label>
                <select
                  id="category_id"
                  name="category_id"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-hairline bg-canvas px-2.5 text-sm text-ink outline-none focus:border-primary"
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatThousands(priceBuy)}
                      onChange={(e) => setPriceBuy(onlyDigits(e.target.value))}
                    />
                  </InputGroup>
                  <input type="hidden" name="price_buy" value={priceBuy} />
                </div>
                <div>
                  <label htmlFor="price_sell" className="text-xs text-ink-muted mb-1 block">Harga Jual</label>
                  <InputGroup className="bg-canvas">
                    <InputGroupAddon>Rp</InputGroupAddon>
                    <InputGroupInput
                      id="price_sell"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatThousands(priceSell)}
                      onChange={(e) => setPriceSell(onlyDigits(e.target.value))}
                      aria-invalid={!!fieldErrors.price_sell}
                    />
                  </InputGroup>
                  <input type="hidden" name="price_sell" value={priceSell} />
                  {fieldErrors.price_sell && <p className="mt-1 text-xs text-destructive">{fieldErrors.price_sell}</p>}
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
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder="Opsional"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setScanOpen(true)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-ink-muted active:bg-canvas"
                    aria-label="Pindai barcode"
                  >
                    <Camera className="size-4" />
                  </button>
                </div>
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
    <BarcodeScanner
      open={scanOpen}
      onOpenChange={setScanOpen}
      onDetect={(code) => {
        setBarcode(code)
        setDirty(true)
        setScanOpen(false)
      }}
    />
    <PhotoCapture
      open={photoOpen}
      onOpenChange={setPhotoOpen}
      onCapture={(file) => uploadFile(file)}
    />
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Buang perubahan?</DialogTitle>
          <DialogDescription>
            Ada data yang belum disimpan. Jika keluar sekarang, perubahan akan hilang.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDiscardOpen(false)}>
            Lanjut Isi
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDiscardOpen(false)
              setDirty(false)
              setOpen(false)
            }}
          >
            Buang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

