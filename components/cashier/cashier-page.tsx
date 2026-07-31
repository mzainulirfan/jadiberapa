"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getProducts, getCategories } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import { toast } from "sonner"
import { Search, Filter, Barcode, X, Check, Package, CartAlt } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { BxProduct, BxCategory } from "@/components/products/types"

function ProductCard({
  p,
  qty,
  popKey,
  onAdd,
}: {
  p: BxProduct
  qty: number
  popKey: number
  onAdd: () => void
}) {
  const out = p.stock <= 0
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={out}
      className={cn(
        "relative overflow-hidden rounded-xl border border-hairline bg-canvas text-left transition-colors",
        out ? "opacity-40" : "hover:border-primary/30 active:border-primary/40"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas-soft">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-faint">
            <Package className="size-8" />
          </div>
        )}
        {out && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-white">
            Habis
          </span>
        )}
        {qty > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {qty}
          </span>
        )}
        {popKey > 0 && (
          <span key={popKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="animate-cart-pop rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">
              +1
            </span>
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium text-ink">{p.name}</p>
        <p className="truncate text-xs text-ink-muted">{p.categories?.name ?? "Tanpa kategori"}</p>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <p className="text-sm font-semibold text-primary">Rp{p.price_sell.toLocaleString()}</p>
          {!out && p.stock <= 5 && (
            <span className="text-[11px] font-medium text-amber-600">Stok {p.stock}</span>
          )}
        </div>
      </div>
    </button>
  )
}

export function CashierPage() {
  const [products, setProducts] = useState<BxProduct[]>([])
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const [catOpen, setCatOpen] = useState(false)
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

  const cards =
    loading
      ? null
      : products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            qty={qtyMap[p.id] ?? 0}
            popKey={pop?.id === p.id ? pop.key : 0}
            onAdd={() => addToCart(p)}
          />
        ))

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
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink-muted mt-1">Barang Populer</p>
                <div className="grid grid-cols-2 gap-2">{cards}</div>
              </>
            )}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-ink-faint">
            <p className="text-sm">Barang tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">{cards}</div>
        )}
      </div>

      {count > 0 && (
        <div className="shrink-0 border-t border-hairline bg-canvas px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="flex w-full items-center justify-between rounded-full bg-ink px-5 py-3.5 text-white shadow-lg"
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
