"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getProducts, getCategories } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import { ProductCard, ProductRow } from "./product-card"
import { toast } from "sonner"
import { Search, Filter, Barcode, X, Check, CartAlt, Grid, List } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { BxProduct, BxCategory } from "@/components/products/types"

export function CashierPage() {
  const [products, setProducts] = useState<BxProduct[]>([])
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const [catOpen, setCatOpen] = useState(false)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [pop, setPop] = useState<{ id: string; key: number } | null>(null)
  const popKeyRef = useRef(0)
  const { items, addItem, count, total } = useCart()
  const router = useRouter()

  const qtyMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of items) m[i.product.id] = i.qty
    return m
  }, [items])

  function addToCart(p: BxProduct) {
    const inCart = items.find((i) => i.product.id === p.id)
    if (inCart && inCart.qty >= p.stock) {
      toast.info(`Stok ${p.name} maksimal`)
      return
    }
    addItem(p)
    popKeyRef.current += 1
    setPop({ id: p.id, key: popKeyRef.current })
  }

  async function handleBarcodeEnter() {
    const term = search.trim()
    if (!term) return
    const { data } = await getProducts({ search: term })
    const exact =
      data.find((p) => p.barcode === term || p.sku === term) ??
      (data.length === 1 ? data[0] : null)
    if (exact) {
      addToCart(exact)
      setSearch("")
    }
  }

  const isIdle = !search.trim() && catIds.length === 0

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
    const idle = !search.trim() && catIds.length === 0
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await getProducts({
        search: idle ? undefined : search.trim() || undefined,
        categoryIds: idle ? undefined : catIds.length > 0 ? catIds : undefined,
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
  }, [search, catIds])

  const activeCats = categories.filter((c) => catIds.includes(c.id))

  const productGrid =
    view === "list" ? (
      <div className="space-y-1.5">
        {products.map((p) => (
          <ProductRow key={p.id} p={p} qty={qtyMap[p.id] ?? 0} onAdd={() => addToCart(p)} />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            qty={qtyMap[p.id] ?? 0}
            popKey={pop?.id === p.id ? pop.key : 0}
            onAdd={() => addToCart(p)}
          />
        ))}
      </div>
    )

  const skeleton =
    view === "list" ? (
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
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
              className="pl-8 pr-11"
            />
            <button
              type="button"
              onClick={() => document.getElementById("cashier-search")?.focus()}
              title="Masukkan atau scan barcode"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted active:bg-canvas-soft"
            >
              <Barcode className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label={view === "grid" ? "Tampilan daftar" : "Tampilan grid"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas-soft text-ink-muted transition-colors active:bg-canvas"
          >
            {view === "grid" ? <List className="size-4" /> : <Grid className="size-4" />}
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
            <span className="text-base font-bold">Rp{total.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  )
}
