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
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ProductDialog } from "./product-dialog"
import { StockAdjustDialog } from "./stock-adjust-dialog"
import {
  getProducts,
  getCategories,
  getInventorySummary,
  resolveDiscountAmount,
} from "@/lib/db/queries"
import {
  deleteProduct,
  type ProductSort,
} from "@/lib/actions/products"
import { Search, Plus, Pencil, Trash, Check, ChevronDown, Grid, List, X, Package, Printer, Barcode as BarcodeIcon } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import type { BxProduct, BxCategory } from "./types"
import { Barcode, barcodeSvgString } from "@/components/ui/barcode"
import { BarcodeScanner } from "@/components/cashier/barcode-scanner"
import { useCart } from "@/components/cart/cart-provider"
import { useRole } from "@/lib/hooks/use-role"

const PAGE_SIZE = 20

const sortOptions: { id: ProductSort; label: string }[] = [
  { id: "name-asc", label: "Nama (A-Z)" },
  { id: "price-asc", label: "Harga Terendah" },
  { id: "price-desc", label: "Harga Tertinggi" },
  { id: "stock-asc", label: "Stok Terkecil" },
  { id: "stock-desc", label: "Stok Terbesar" },
]

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  )
}

function printProductLabel(p: BxProduct) {
  if (!p.barcode) return
  const svg = barcodeSvgString(p.barcode, "EAN13", { height: 50, fontSize: 14 })
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Label</title>
<style>
  @page { size: 50mm 30mm; margin: 2mm; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #000; }
  .label { width: 46mm; text-align: center; }
  .name { font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price { font-size: 12px; font-weight: 700; margin: 1px 0 2px; }
  svg { max-width: 100%; }
</style>
</head>
<body>
  <div class="label">
    <div class="name">${escapeHtml(p.name)}</div>
    <div class="price">Rp${p.price_sell.toLocaleString("id-ID")}</div>
    ${svg}
  </div>
</body>
</html>`

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.setAttribute("aria-hidden", "true")
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => iframe.remove(), 1000)
}

function StockBadge({ stock, min = 5 }: { stock: number; min?: number }) {
  if (stock <= 0) return <Badge variant="destructive">Habis</Badge>
  if (stock <= min)
    return (
      <Badge variant="outline" className="border-accent-orange/30 bg-accent-orange/10 text-accent-orange">
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
  const { discounts } = useCart()
  const role = useRole()
  const canManage = role === "owner"
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
  const [selected, setSelected] = useState<BxProduct | null>(null)
  const [stockTarget, setStockTarget] = useState<BxProduct | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [lowStock, setLowStock] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [addBarcode, setAddBarcode] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ count: number; stockValue: number; lowStock: number } | null>(null)

  const discountOf = (p: BxProduct) => resolveDiscountAmount(p.id, p.price_sell, discounts)

  function toggleCat(id: string) {
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  useEffect(() => {
    getInventorySummary().then(setSummary)
  }, [])

  useEffect(() => {
    const v = localStorage.getItem("products_view")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron preferensi setelah mount
    if (v === "list" || v === "grid") setView(v)
  }, [])

  useEffect(() => {
    localStorage.setItem("products_view", view)
  }, [view])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const { data, total: count } = await getProducts({
        search,
        categoryIds: catIds,
        sort,
        lowStock,
        page: 0,
        pageSize: PAGE_SIZE,
        withCount: true,
      })
      if (!cancelled) {
        setProducts(data)
        setTotal(count)
        setPage(0)
        setLoading(false)
      }
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, catIds, sort, lowStock])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await getProducts({
      search,
      categoryIds: catIds,
      sort,
      lowStock,
      page: page + 1,
      pageSize: PAGE_SIZE,
    })
    setProducts((prev) => [...prev, ...data])
    setPage((p) => p + 1)
    setLoadingMore(false)
  }

  async function reload() {
    setLoading(true)
    const [{ data, total: count }, cats] = await Promise.all([
      getProducts({ search, categoryIds: catIds, sort, lowStock, page: 0, pageSize: PAGE_SIZE, withCount: true }),
      getCategories(),
    ])
    setProducts(data)
    setTotal(count)
    setCategories(cats)
    setPage(0)
    setLoading(false)
    getInventorySummary().then(setSummary)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const res = await deleteProduct(deleteTarget.id)
    if (res?.error) {
      toast.error("Gagal menghapus barang")
      return
    }
    const id = deleteTarget.id
    setDeleteTarget(null)
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    getInventorySummary().then(setSummary)
    toast.success("Barang dihapus")
  }

  async function resolveCode(term: string): Promise<BxProduct | null> {
    const { data } = await getProducts({ search: term, pageSize: PAGE_SIZE })
    return (
      data.find((p) => p.barcode === term || p.sku === term) ??
      (data.length === 1 ? data[0] : null)
    )
  }

  async function handleScan(code: string) {
    const p = await resolveCode(code)
    if (p) {
      setSelected(p)
    } else if (canManage) {
      setAddBarcode(code)
      toast.info("Barcode belum terdaftar")
    } else {
      toast.info("Barcode belum terdaftar")
    }
  }

  const hasMore = products.length < total
  const activeCats = categories.filter((c) => catIds.includes(c.id))
  const sortLabel = sortOptions.find((s) => s.id === sort)?.label ?? "Nama (A-Z)"
  const isFiltering = search.trim() !== "" || catIds.length > 0 || lowStock

  return (
    <div className="p-4 space-y-3">
      {summary && (
        <div className="flex items-center divide-x divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          <div className="flex-1 px-3 py-2">
            <p className="text-[11px] text-ink-muted">Barang</p>
            <p className="text-sm font-bold text-ink">{summary.count}</p>
          </div>
          <div className="flex-1 px-3 py-2">
            <p className="text-[11px] text-ink-muted">Nilai Stok</p>
            <p className="truncate text-sm font-bold text-ink">Rp{summary.stockValue.toLocaleString("id-ID")}</p>
          </div>
          <button
            type="button"
            onClick={() => setLowStock((v) => !v)}
            className={cn(
              "flex-1 px-3 py-2 text-left transition-colors active:bg-canvas-soft",
              lowStock && "bg-accent-orange/10"
            )}
          >
            <p className="text-[11px] text-ink-muted">Menipis</p>
            <p className={cn("text-sm font-bold", summary.lowStock > 0 ? "text-accent-orange" : "text-ink")}>
              {summary.lowStock}
            </p>
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
          <Input
            placeholder="Cari nama, SKU, atau barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              <BarcodeIcon className="size-4" />
            </button>
          </div>
        </div>
        {canManage && (
          <ProductDialog product={null} onSaved={reload}>
            <Button className="rounded-full size-9 p-0">
              <Plus className="size-5" />
            </Button>
          </ProductDialog>
        )}
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

        <button
          type="button"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          aria-label={view === "grid" ? "Tampilan daftar" : "Tampilan grid"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas-soft text-ink-muted transition-colors active:bg-canvas"
        >
          {view === "grid" ? <List className="size-4" /> : <Grid className="size-4" />}
        </button>
      </div>

      {(catIds.length > 0 || lowStock) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {lowStock && (
            <Badge variant="default" className="gap-1 rounded-full bg-accent-orange">
              Stok menipis
              <button
                type="button"
                onClick={() => setLowStock(false)}
                className="-mr-0.5 flex size-4 items-center justify-center rounded-full hover:bg-primary-foreground/20"
                aria-label="Hapus filter stok menipis"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
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
            onClick={() => {
              setCatIds([])
              setLowStock(false)
            }}
            className="text-xs text-ink-muted active:text-ink"
          >
            Hapus semua
          </button>
        </div>
      )}

      {loading ? (
        view === "grid" ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-hairline bg-canvas">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="space-y-1.5 p-2.5">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-3 w-14 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas p-2.5"
              >
                <Skeleton className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="mt-1.5 h-3 w-20 rounded-full" />
                </div>
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="size-4 shrink-0 rounded-sm" />
              </div>
            ))}
          </div>
        )
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-ink-faint">
          {isFiltering ? (
            <p className="text-sm">Barang tidak ditemukan</p>
          ) : (
            <>
              <p className="text-sm">Belum ada barang</p>
              {canManage && <p className="text-xs mt-1">Tambah barang pertama</p>}
            </>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-2">
          {products.map((p) => {
            const disc = discountOf(p)
            const net = p.price_sell - disc
            return (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-canvas"
              >
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className="flex flex-col text-left"
                >
                  <div className="relative">
                    <ProductThumb p={p} className="aspect-[4/3] w-full rounded-none" />
                    {disc > 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-accent-orange px-2 py-0.5 text-[10px] font-semibold text-white">
                        -Rp{disc.toLocaleString("id-ID")}
                      </span>
                    )}
                    {p.categories?.name && (
                      <span className="absolute right-1.5 top-1.5 max-w-[75%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {p.categories.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-2.5">
                    <p className="text-sm font-medium text-ink line-clamp-2 min-h-10">{p.name}</p>
                    <StockBadge stock={p.stock} min={p.min_stock} />
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-primary">
                        Rp{net.toLocaleString()}
                      </p>
                      {disc > 0 && (
                        <p className="text-[11px] text-ink-faint line-through">
                          Rp{p.price_sell.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {canManage && (
                  <div className="flex items-center justify-end gap-1 px-2.5 pb-2.5">
                    <ProductDialog product={p} onSaved={reload}>
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
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {products.map((p) => {
            const disc = discountOf(p)
            const net = p.price_sell - disc
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-2.5"
              >
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative">
                    <ProductThumb p={p} className="size-12" />
                    {disc > 0 && (
                      <span className="absolute -left-1 -top-1 rounded-full bg-accent-orange px-1.5 py-px text-[9px] font-semibold text-white">
                        -Rp{disc.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <StockBadge stock={p.stock} min={p.min_stock} />
                    </div>
                    <p className="truncate text-xs text-ink-muted">
                      {p.categories?.name ? `${p.categories.name} · ` : ""}
                      {p.unit && p.unit !== "pcs" ? `${p.unit} · ` : ""}
                      {p.sku ? `SKU ${p.sku}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <p className="text-sm font-semibold text-primary">Rp{net.toLocaleString()}</p>
                      {disc > 0 && (
                        <span className="text-[11px] text-ink-faint line-through">
                          Rp{p.price_sell.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <ProductDialog product={p} onSaved={reload}>
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
                )}
              </div>
            )
          })}
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

      <Drawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        showSwipeHandle
      >
        <DrawerContent className="rounded-t-xl">
          {selected && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative shrink-0">
                <div className="aspect-[16/9] w-full overflow-hidden bg-canvas-soft">
                  {selected.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.image_url}
                      alt={selected.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Package className="size-12 text-ink-faint" />
                    </div>
                  )}
                </div>
                <DrawerClose className="absolute right-3 top-3 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm">
                  <X className="size-4" />
                </DrawerClose>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-ink leading-snug">{selected.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <StockBadge stock={selected.stock} min={selected.min_stock} />
                    {selected.categories?.name && (
                      <Badge variant="outline" className="rounded-full">
                        {selected.categories.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-2xl font-bold text-primary">
                  Rp{selected.price_sell.toLocaleString()}
                </p>

                <div className="rounded-xl bg-canvas-soft p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Stok</span>
                    <span className="font-medium text-ink">{selected.stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">SKU</span>
                    <span className="text-ink">{selected.sku || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Harga Beli</span>
                    <span className="text-ink">
                      Rp{selected.price_buy.toLocaleString()}
                    </span>
                  </div>
                  {selected.price_buy > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Margin</span>
                      <span className="text-ink">
                        Rp{(selected.price_sell - selected.price_buy).toLocaleString()}
                        {" · "}
                        {Math.round(((selected.price_sell - selected.price_buy) / selected.price_buy) * 100)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Ditambahkan</span>
                    <span className="text-ink">
                      {format(new Date(selected.created_at), "dd MMM yyyy", { locale: localeId })}
                    </span>
                  </div>
                </div>

                {selected.barcode && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-canvas p-3">
                    <Barcode
                      value={selected.barcode}
                      format="auto"
                      height={44}
                      className="max-w-[240px]"
                    />
                    <button
                      type="button"
                      onClick={() => printProductLabel(selected)}
                      className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink active:bg-canvas-soft"
                    >
                      <Printer className="size-3.5" />
                      Cetak Label
                    </button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2 border-t border-hairline p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  variant="outline"
                  className="w-full rounded-full gap-1.5"
                  onClick={() => {
                    setStockTarget(selected)
                    setSelected(null)
                  }}
                >
                  <Package className="size-4" />
                  Kelola Stok
                </Button>
                {canManage && (
                  <div className="flex gap-2">
                    <ProductDialog product={selected} onSaved={reload}>
                      <Button variant="outline" className="flex-1 rounded-full gap-1.5">
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    </ProductDialog>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-full gap-1.5"
                      onClick={() => {
                        setDeleteTarget(selected)
                        setSelected(null)
                      }}
                    >
                      <Trash className="size-4" />
                      Hapus
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

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

      <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetect={handleScan}
      />
      <StockAdjustDialog
        product={stockTarget}
        open={stockTarget !== null}
        onOpenChange={(v) => {
          if (!v) setStockTarget(null)
        }}
        canAdjust={canManage}
        onSaved={reload}
      />
      <ProductDialog
        open={addBarcode !== null}
        onOpenChange={(v) => {
          if (!v) setAddBarcode(null)
        }}
        initialBarcode={addBarcode ?? undefined}
        onSaved={() => {
          setAddBarcode(null)
          reload()
        }}
      />
    </div>
  )
}
