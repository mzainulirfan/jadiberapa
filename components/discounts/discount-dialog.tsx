"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { getProducts, type BxDiscount } from "@/lib/db/queries"
import {
  createDiscount,
  updateDiscount,
  type DiscountType,
  type DiscountValueType,
} from "@/lib/actions/discounts"
import type { BxProduct } from "@/components/products/types"
import { Check, Search, X, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const formatThousands = (raw: string) => (raw ? Number(raw).toLocaleString("id-ID") : "")

const typeOptions: { id: DiscountType; label: string; desc: string }[] = [
  { id: "product", label: "Produk", desc: "Harga promo untuk produk tertentu" },
  { id: "category", label: "Kategori", desc: "Grup diskon berisi produk pilihan" },
  { id: "global", label: "Semua Barang", desc: "Berlaku ke seluruh produk" },
]

type Props = {
  discount?: BxDiscount | null
  children?: React.ReactNode
  onSaved?: () => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function DiscountDialog({
  discount,
  children,
  onSaved,
  open: openProp,
  onOpenChange: onOpenChangeProp,
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

  const [name, setName] = useState("")
  const [type, setType] = useState<DiscountType>("product")
  const [valueType, setValueType] = useState<DiscountValueType>("percent")
  const [value, setValue] = useState("")
  const [productIds, setProductIds] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<BxProduct[]>([])
  const [search, setSearch] = useState("")
  const [loadingProds, setLoadingProds] = useState(false)
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    value?: string
    products?: string
    form?: string
  }>({})
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form tiap drawer dibuka
    setName(discount?.name ?? "")
    setType(discount?.type ?? "product")
    setValueType(discount?.value_type ?? "percent")
    setValue(discount ? String(discount.value) : "")
    setProductIds(new Set(discount?.product_ids ?? []))
    setSearch("")
    setFieldErrors({})
    setPending(false)
  }, [open, discount])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoadingProds(true)
      const { data } = await getProducts({
        search: search.trim() || undefined,
        limit: 60,
      })
      if (!cancelled) {
        setProducts(data)
        setLoadingProds(false)
      }
    }, search.trim() ? 150 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, search])

  function toggleProduct(id: string) {
    setProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    const v = Number(value.replace(/[^\d]/g, "")) || 0
    const errs: typeof fieldErrors = {}
    if (!name.trim()) errs.name = "Nama diskon wajib diisi."
    if (v <= 0) errs.value = "Besar diskon harus lebih dari 0."
    if (type !== "global" && productIds.size === 0) {
      errs.products = "Pilih minimal satu produk."
    }
    setFieldErrors(errs)
    if (errs.name || errs.value || errs.products) return

    setPending(true)
    const res = discount
      ? await updateDiscount(
          discount.id,
          name.trim(),
          type,
          valueType,
          v,
          [...productIds]
        )
      : await createDiscount(name.trim(), type, valueType, v, [...productIds])
    setPending(false)
    if (res.error) {
      setFieldErrors({ form: res.error })
      return
    }
    setOpen(false)
    onSavedRef.current?.()
  }

  const showPicker = type !== "global"

  return (
    <Drawer open={open} modal onOpenChange={(v) => (v ? setOpen(true) : setOpen(false))} showSwipeHandle>
      {children ? <DrawerTrigger render={children as React.ReactElement} /> : null}
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <DrawerTitle className="text-lg font-bold">
            {discount ? "Edit Diskon" : "Tambah Diskon"}
          </DrawerTitle>
          <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Aturan
              </p>
              <div>
                <label htmlFor="discount-name" className="text-xs text-ink-muted mb-1 block">
                  Nama Diskon
                </label>
                <Input
                  id="discount-name"
                  placeholder="Contoh: Promo Lebaran"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Berlaku Untuk</label>
                <div className="flex overflow-hidden rounded-full border border-hairline">
                  {typeOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={cn(
                        "flex-1 px-1 py-2 text-xs font-medium transition-colors",
                        type === t.id
                          ? "bg-primary/10 text-primary"
                          : "bg-canvas-soft text-ink-muted"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {typeOptions.find((t) => t.id === type)?.desc}
                </p>
              </div>
              <div>
                <label className="text-xs text-ink-muted mb-1 block">Besar Diskon</label>
                <div className="flex items-center gap-2">
                  <div className="flex overflow-hidden rounded-full border border-hairline">
                    {(["percent", "amount"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setValueType(t)}
                        className={cn(
                          "px-3.5 py-2 text-sm font-medium transition-colors",
                          valueType === t
                            ? "bg-primary/10 text-primary"
                            : "bg-canvas-soft text-ink-muted"
                        )}
                      >
                        {t === "percent" ? "%" : "Rp"}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={valueType === "percent" ? "0%" : "Nominal (Rp)"}
                      value={formatThousands(value)}
                      onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
                      className="text-base font-semibold"
                      aria-invalid={!!fieldErrors.value}
                    />
                  </div>
                </div>
                {fieldErrors.value && <p className="mt-1 text-xs text-destructive">{fieldErrors.value}</p>}
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  Diskon per item. Prioritas saat bertumpuk: Produk &gt; Kategori &gt; Semua Barang.
                </p>
              </div>
            </div>

            {showPicker && (
              <div className="rounded-xl bg-canvas-soft p-3 space-y-3">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Produk {type === "product" ? "Terpilih" : "dalam Kategori"}
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
                  <Input
                    placeholder="Cari barang..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 bg-canvas"
                  />
                </div>
                {fieldErrors.products && (
                  <p className="text-xs text-destructive">{fieldErrors.products}</p>
                )}
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-hairline bg-canvas p-1.5">
                  {loadingProds ? (
                    <p className="px-2 py-3 text-center text-xs text-ink-faint">Memuat barang...</p>
                  ) : products.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-ink-faint">
                      Barang tidak ditemukan
                    </p>
                  ) : (
                    products.map((p) => {
                      const selected = productIds.has(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                            selected ? "bg-primary/10" : "active:bg-canvas-soft"
                          )}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-canvas-soft text-ink-faint">
                            <Package className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{p.name}</span>
                            <span className="block text-[11px] text-ink-muted">
                              Rp{p.price_sell.toLocaleString("id-ID")}
                            </span>
                          </span>
                          {selected && <Check className="size-4 shrink-0 text-primary" />}
                        </button>
                      )
                    })
                  )}
                </div>
                {productIds.size > 0 && (
                  <p className="text-[11px] text-ink-faint">{productIds.size} produk dipilih</p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {fieldErrors.form && <p className="text-destructive text-sm mb-2">{fieldErrors.form}</p>}
            <Button onClick={handleSubmit} className="w-full rounded-full h-11 text-base" disabled={pending}>
              {pending ? "Menyimpan..." : discount ? "Simpan Perubahan" : "Tambah Diskon"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
