"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getProducts, getCategories, resolveDiscountAmount, getProductVariants } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import { ProductCard, ProductRow } from "./product-card"
import { BarcodeScanner } from "./barcode-scanner"
import { ProductDialog } from "@/components/products/product-dialog"
import { toast } from "sonner"
import { Search, Filter, Barcode, X, Check, CartAlt, Grid, List, Star, Package } from "@/components/ui/icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { BxProduct, BxCategory, BxVariant } from "@/components/products/types"

export function CashierPage() {
  const [products, setProducts] = useState<BxProduct[]>([])
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [variantsMap, setVariantsMap] = useState<Record<string, BxVariant[]>>({})
  const [pickProduct, setPickProduct] = useState<BxProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const [favOnly, setFavOnly] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [scanOpen, setScanOpen] = useState(false)
  const [unknownCode, setUnknownCode] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const { items, addItem, count, netTotal, discounts } = useCart()
  const router = useRouter()

  const discOf = (p: BxProduct) => resolveDiscountAmount(p.id, p.price_sell, discounts)

  const qtyMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of items) m[i.product.id] = (m[i.product.id] ?? 0) + i.qty
    return m
  }, [items])

  function addToCart(p: BxProduct, variant?: BxVariant) {
    const inCartQty = items
      .filter((i) => i.product.id === p.id)
      .reduce((sum, i) => sum + i.qty, 0)
    if (inCartQty >= p.stock) {
      toast.info(`Stok ${p.name} maksimal`)
      return
    }
    addItem(p, variant)
    popKeyRef.current += 1
    setPop({ id: p.id, key: popKeyRef.current })
  }

  function handleAdd(p: BxProduct) {
    const variants = variantsMap[p.id]
    if (variants && variants.length > 0) {
      setPickProduct(p)
      return
    }
    addToCart(p)
  }

  function handlePickVariant(v: BxVariant) {
    if (!pickProduct) return
    addToCart(pickProduct, v)
    setPickProduct(null)
  }

  async function resolveCode(term: string): Promise<BxProduct | null> {
    const { data } = await getProducts({ search: term })
    return (
      data.find((p) => p.barcode === term || p.sku === term) ??
      (data.length === 1 ? data[0] : null)
    )
  }

  async function handleBarcodeEnter() {
    const term = search.trim()
    if (!term) return
    const exact = await resolveCode(term)
    if (exact) {
      addToCart(exact)
      setSearch("")
    }
  }

  async function handleScan(code: string) {
    const p = await resolveCode(code)
    if (p) {
      addToCart(p)
      toast.success(`+ ${p.name}`)
    } else {
      setScanOpen(false)
      setUnknownCode(code)
      toast.info("Barcode belum terdaftar")
    }
  }

  const isIdle = !search.trim() && catIds.length === 0 && !favOnly

  function toggleCat(id: string) {
    setCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    const v = localStorage.getItem("cashier_view")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron preferensi tersimpan sekali setelah mount
    if (v === "list" || v === "grid") setView(v)
  }, [])

  useEffect(() => {
    localStorage.setItem("cashier_view", view)
  }, [view])

  useEffect(() => {
    let cancelled = false
    const idle = !search.trim() && catIds.length === 0 && !favOnly
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await getProducts({
        search: idle ? undefined : search.trim() || undefined,
        categoryIds: idle ? undefined : catIds.length > 0 ? catIds : undefined,
        isFavorite: favOnly ? true : undefined,
        limit: idle ? 8 : undefined,
      })
      if (!cancelled) {
        setProducts(data)
        setLoading(false)
      }
    }, idle ? 0 : 150)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, catIds, favOnly, reloadKey])

  // Muat daftar varian untuk semua produk yang tampil, agar kartu bisa
  // membuka pemilih varian saat produk punya varian.
  useEffect(() => {
    if (products.length === 0) return
    let cancelled = false
    getProductVariants(products.map((p) => p.id)).then((vs) => {
      if (cancelled) return
      const m: Record<string, BxVariant[]> = {}
      for (const v of vs) {
        ;(m[v.product_id] ??= []).push(v)
      }
      setVariantsMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [products])

  const hasVariants = (p: BxProduct) => (variantsMap[p.id]?.length ?? 0) > 0

  const activeCats = categories.filter((c) => catIds.includes(c.id))

  const productGrid =
    view === "list" ? (
      <div className="space-y-1.5">
        {products.map((p) => (
          <ProductRow
            key={p.id}
            p={p}
            qty={qtyMap[p.id] ?? 0}
            discount={discOf(p)}
            hasVariants={hasVariants(p)}
            onAdd={() => handleAdd(p)}
          />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            qty={qtyMap[p.id] ?? 0}
            discount={discOf(p)}
            hasVariants={hasVariants(p)}
            popKey={pop?.id === p.id ? pop.key : 0}
            onAdd={() => handleAdd(p)}
          />
        ))}
      </div>
    )

  const skeleton =
    view === "list" ? (
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-2.5"
          >
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="mt-1.5 h-3 w-20 rounded-full" />
            </div>
            <div className="shrink-0 text-right">
              <Skeleton className="h-4 w-14 rounded-md" />
              <Skeleton className="mt-1 ml-auto h-3 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-hairline bg-canvas">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-1.5 p-2.5">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    )

  return (
    <div className="relative flex h-full flex-col">
      <div className="p-4 pb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
            <Input
              id="cashier-search"
              placeholder="Cari / scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBarcodeEnter()
              }}
              className={`pl-8 ${search ? "pr-[4.5rem]" : "pr-10"}`}
            />
            <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Hapus pencarian"
                  className="flex size-8 items-center justify-center rounded-full text-ink-muted active:bg-canvas-soft active:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                title="Pindai barcode dengan kamera"
                aria-label="Pindai barcode dengan kamera"
                className="flex size-8 items-center justify-center rounded-full text-ink-muted active:bg-canvas-soft active:text-ink"
              >
                <Barcode className="size-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label={view === "grid" ? "Tampilan daftar" : "Tampilan grid"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas-soft text-ink-muted transition-colors active:bg-canvas"
          >
            {view === "grid" ? <List className="size-4" /> : <Grid className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-label="Tampilkan barang favorit"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
              favOnly
                ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                : "border-hairline bg-canvas-soft text-ink-muted"
            )}
          >
            <Star className="size-4" />
          </button>
          <Popover open={catOpen} onOpenChange={setCatOpen}>
            <PopoverTrigger
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors",
                catOpen || catIds.length > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-hairline bg-canvas-soft text-ink-muted"
              )}
              aria-label="Filter kategori"
            >
              <Filter className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {categories.map((c) => {
                const selected = catIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft",
                      selected && "font-medium text-primary"
                    )}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    {selected && <Check className="size-4" />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>

        {catIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {activeCats.map((c) => (
              <Badge key={c.id} variant="default" className="rounded-full gap-1">
                {c.name}
                <button
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className="-mr-0.5 flex size-4 items-center justify-center rounded-full hover:bg-primary-foreground/20"
                  aria-label={`Hapus ${c.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <button
              type="button"
              onClick={() => setCatIds([])}
              className="text-xs text-ink-muted active:text-ink"
            >
              Hapus semua
            </button>
          </div>
        )}
      </div>

      <div className={cn("flex-1 overflow-y-auto p-4 pt-2", count > 0 && "pb-28")}>
        {isIdle ? (
          <div className="space-y-3">
            {loading ? (
              skeleton
            ) : (
              <>
                <p className="mt-1 text-sm font-semibold text-ink-muted">Barang</p>
                {productGrid}
              </>
            )}
          </div>
        ) : loading ? (
          skeleton
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-ink-faint">
            <p className="text-sm">Barang tidak ditemukan</p>
          </div>
        ) : (
          productGrid
        )}
      </div>

      {count > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-hairline bg-canvas px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="flex w-full items-center justify-between rounded-full bg-ink px-5 py-3.5 text-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <CartAlt className="size-4" />
              {count} item
            </span>
            <span className="text-base font-bold">Rp{netTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetect={handleScan}
        continuous
      />

      <Dialog open={pickProduct !== null} onOpenChange={(v) => !v && setPickProduct(null)}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih Varian</DialogTitle>
          </DialogHeader>
          {pickProduct && (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-sm text-ink-muted">
                {pickProduct.name}
              </p>
              {variantsMap[pickProduct.id]?.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handlePickVariant(v)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3 text-left active:bg-canvas-soft"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Package className="size-4 text-ink-faint" />
                    {v.name}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    Rp{v.price_sell.toLocaleString()}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickProduct(null)}
                className="mt-1 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted active:bg-canvas-soft"
              >
                Batal
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProductDialog
        open={unknownCode !== null}
        onOpenChange={(v) => {
          if (!v) setUnknownCode(null)
        }}
        initialBarcode={unknownCode ?? undefined}
        onSaved={() => {
          setUnknownCode(null)
          setReloadKey((k) => k + 1)
        }}
      />
    </div>
  )
}
