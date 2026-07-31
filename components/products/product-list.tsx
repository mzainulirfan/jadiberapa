"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ProductDialog } from "./product-dialog"
import {
  getProductsPage,
  getCategories,
  deleteProduct,
  type ProductSort,
} from "@/lib/actions/products"
import { Search, Plus, Pencil, Trash, Check, ChevronDown, Grid, List, X, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { BxProduct, BxCategory } from "./types"

const PAGE_SIZE = 20

const sortOptions: { id: ProductSort; label: string }[] = [
  { id: "name-asc", label: "Nama (A-Z)" },
  { id: "price-asc", label: "Harga Terendah" },
  { id: "price-desc", label: "Harga Tertinggi" },
  { id: "stock-asc", label: "Stok Terkecil" },
  { id: "stock-desc", label: "Stok Terbesar" },
]

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Habis</Badge>
  if (stock <= 5)
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
        Stok {stock}
      </Badge>
    )
  return null
}

function ProductThumb({ p, className }: { p: BxProduct; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas-soft text-ink-faint",
        className
      )}
    >
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-6" />
      )}
    </div>
  )
}

export function ProductList() {
  const [products, setProducts] = useState<BxProduct[]>([])
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const [sort, setSort] = useState<ProductSort>("name-asc")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BxProduct | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  function toggleCat(id: string) {
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const { data, total: count } = await getProductsPage({
        search,
        categoryIds: catIds,
        sort,
        page: 0,
        pageSize: PAGE_SIZE,
      })
      if (!cancelled) {
        setProducts(data)
        setTotal(count)
        setPage(0)
        setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, catIds, sort])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await getProductsPage({
      search,
      categoryIds: catIds,
      sort,
      page: page + 1,
      pageSize: PAGE_SIZE,
    })
    setProducts((prev) => [...prev, ...data])
    setPage((p) => p + 1)
    setLoadingMore(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteProduct(deleteTarget.id)
    setDeleteTarget(null)
    setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setTotal((t) => Math.max(0, t - 1))
  }

  const hasMore = products.length < total
  const activeCats = categories.filter((c) => catIds.includes(c.id))
  const sortLabel = sortOptions.find((s) => s.id === sort)?.label ?? "Nama (A-Z)"

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
          <Input
            placeholder="Cari nama, SKU, atau barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <ProductDialog product={null}>
          <Button className="rounded-full size-9 p-0">
            <Plus className="size-5" />
          </Button>
        </ProductDialog>
      </div>

      <div className="flex items-center gap-2">
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger
            className={cn(
              "flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border px-2.5 text-sm outline-none transition-colors",
              catOpen || catIds.length > 0
                ? "border-primary bg-primary/10 text-ink"
                : "border-hairline bg-canvas-soft text-ink-muted"
            )}
            aria-label="Filter kategori"
          >
            <span className="truncate">
              {catIds.length > 0 ? `Kategori (${catIds.length})` : "Semua Kategori"}
            </span>
            <ChevronDown className="size-3.5 shrink-0" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
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

        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger
            className="flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-hairline bg-canvas-soft px-2.5 text-sm text-ink-muted outline-none"
            aria-label="Urutkan"
          >
            <span className="truncate">{sortLabel}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            {sortOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setSort(o.id)
                  setSortOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft",
                  sort === o.id && "font-medium text-primary"
                )}
              >
                <span className="flex-1">{o.label}</span>
                {sort === o.id && <Check className="size-4" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-hairline bg-canvas-soft p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Tampilan grid"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "grid" ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
            )}
          >
            <Grid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="Tampilan list"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "list" ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {catIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-ink-faint">
          <p className="text-sm">Belum ada barang</p>
          <p className="text-xs mt-1">Tambah barang pertama</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-canvas"
            >
              <ProductThumb p={p} className="aspect-[4/3] w-full rounded-none" />
              <div className="flex flex-col gap-1 p-2.5">
                <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <StockBadge stock={p.stock} />
                  {p.categories?.name && (
                    <span className="text-[11px] text-ink-faint truncate">{p.categories.name}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-primary">
                  Rp{p.price_sell.toLocaleString()}
                </p>
                {p.price_buy > 0 && (
                  <p className="text-[11px] text-ink-faint">
                    Margin: Rp{(p.price_sell - p.price_buy).toLocaleString()}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <ProductDialog product={p}>
                    <button className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft">
                      <Pencil className="size-4" />
                    </button>
                  </ProductDialog>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg bg-canvas p-2.5 border border-hairline"
            >
              <ProductThumb p={p} className="size-12" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                  <StockBadge stock={p.stock} />
                </div>
                <p className="text-xs text-ink-faint truncate">
                  {p.categories?.name ? `${p.categories.name} · ` : ""}
                  Rp{p.price_sell.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ProductDialog product={p}>
                  <button className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft">
                    <Pencil className="size-4" />
                  </button>
                </ProductDialog>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <Button
          variant="outline"
          className="w-full rounded-full"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Memuat..." : `Muat lebih (${total - products.length})`}
        </Button>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Barang?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; akan dihapus permanen dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
