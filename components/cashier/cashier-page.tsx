"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getProducts, getCategories } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import { toast } from "sonner"
import { Search, Filter, Barcode, X, Check } from "@/components/ui/icons"
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
  const cart = useCart()

  function addToCart(p: BxProduct) {
    cart.addItem(p)
    toast.success(`${p.name} ditambahkan ke keranjang`)
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

  return (
    <div className="flex flex-col flex-1">
      <div className="p-4 pb-3">
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">
          Kasir
        </h1>
        <p className="text-ink-muted text-sm mb-3">Cari dan tambah barang</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
            <Input
              placeholder="Cari barang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-11"
            />
            <button
              type="button"
              title="Scan barcode (segera)"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted active:bg-canvas-soft"
            >
              <Barcode className="size-4" />
            </button>
          </div>
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

      <div className="flex-1 overflow-y-auto p-4 pt-2">
        {isIdle ? (
          <div className="space-y-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink-muted mt-1">Barang Populer</p>
                <div className="grid grid-cols-2 gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={p.stock <= 0}
                      className="text-left rounded-xl bg-canvas border border-hairline p-3 hover:border-primary/30 transition-colors disabled:opacity-40"
                    >
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      {p.categories?.name && (
                        <p className="text-xs text-ink-muted mt-0.5">{p.categories.name}</p>
                      )}
                      <p className="text-sm font-semibold text-primary mt-1">
                        Rp{p.price_sell.toLocaleString()}
                      </p>
                      {p.stock <= 5 && (
                        <p className="text-xs text-ink-faint mt-0.5">Stok: {p.stock}</p>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-ink-faint">
            <p className="text-sm">Barang tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => cart.addItem(p)}
                disabled={p.stock <= 0}
                className="text-left rounded-xl bg-canvas border border-hairline p-3 hover:border-primary/30 transition-colors disabled:opacity-40"
              >
                <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                {p.categories?.name && (
                  <p className="text-xs text-ink-muted mt-0.5">{p.categories.name}</p>
                )}
                <p className="text-sm font-semibold text-primary mt-1">
                  Rp{p.price_sell.toLocaleString()}
                </p>
                {p.stock <= 5 && (
                  <p className="text-xs text-ink-faint mt-0.5">Stok: {p.stock}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
