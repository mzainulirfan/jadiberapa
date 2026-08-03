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
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ProductDialog } from "./product-dialog"
import { StockAdjustDialog } from "./stock-adjust-dialog"
import { BulkImportDialog } from "./bulk-import-dialog"
import { BulkEditDialog } from "./bulk-edit-dialog"
import {
  getProducts,
  getCategories,
  getInventorySummary,
  getProductVariants,
  getProductVariantsByProduct,
  resolveDiscountAmount,
} from "@/lib/db/queries"
import {
  deleteProduct,
  deleteProducts,
  type ProductSort,
} from "@/lib/actions/products"
import { Search, Plus, Pencil, Trash, Check, Grid, List, X, Package, Printer, Barcode as BarcodeIcon, Upload, CheckCircle, DotsHorizontalRounded, Filter } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fmtRp } from "@/lib/format"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import Link from "next/link"
import type { BxProduct, BxCategory, BxVariant } from "./types"
import { ProductThumb, ProductPrice, StockBadge } from "./product-view"
import { Barcode, barcodeSvgString } from "@/components/ui/barcode"
import { BarcodeScanner } from "@/components/cashier/barcode-scanner"
import { useCart } from "@/components/cart/cart-provider"
import { useRole } from "@/lib/hooks/use-role"

const PAGE_SIZE = 20

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

export function ProductList() {
  const { discounts } = useCart()
  const role = useRole()
  const canManage = role === "owner"
  const [products, setProducts] = useState<BxProduct[]>([])
  const [categories, setCategories] = useState<BxCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const sort: ProductSort = "name-asc"
  const [view, setView] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BxProduct | null>(null)
  const [selected, setSelected] = useState<BxProduct | null>(null)
  const [stockTarget, setStockTarget] = useState<BxProduct | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [lowStock, setLowStock] = useState(false)
  const [favOnly, setFavOnly] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [addBarcode, setAddBarcode] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [summary, setSummary] = useState<{ count: number; stockValue: number; lowStock: number } | null>(null)
  const [variants, setVariants] = useState<BxVariant[]>([])
  // Varian di-render hanya jika cocok dengan produk yang sedang dibuka, agar
  // tidak tampil data varian produk lama saat drawer baru saja berpindah.
  const [variantsProductId, setVariantsProductId] = useState<string | null>(null)
  // Tanda "Varian" pada kartu/baris, dimuat untuk semua produk yang tampil.
  const [variantsMap, setVariantsMap] = useState<Record<string, BxVariant[]>>({})

  const discountOf = (p: BxProduct) => resolveDiscountAmount(p.id, p.price_sell, discounts)
  const hasVariants = (p: BxProduct) => (variantsMap[p.id]?.length ?? 0) > 0

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
    if (!selected) return
    getProductVariantsByProduct(selected.id).then((data) => {
      setVariants(data)
      setVariantsProductId(selected.id)
    })
  }, [selected])

  useEffect(() => {
    const v = localStorage.getItem("products_view")
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron preferensi setelah mount
    if (v === "list" || v === "grid") setView(v)
  }, [])

  useEffect(() => {
    localStorage.setItem("products_view", view)
  }, [view])

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

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const { data, total: count } = await getProducts({
        search,
        categoryIds: catIds,
        sort,
        lowStock,
        isFavorite: favOnly ? true : undefined,
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
  }, [search, catIds, sort, lowStock, favOnly])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await getProducts({
      search,
      categoryIds: catIds,
      sort,
      lowStock,
      isFavorite: favOnly ? true : undefined,
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
      getProducts({ search, categoryIds: catIds, sort, lowStock, isFavorite: favOnly ? true : undefined, page: 0, pageSize: PAGE_SIZE, withCount: true }),
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    const res = await deleteProducts([...selectedIds])
    if (res?.error) {
      toast.error("Gagal menghapus barang")
      return
    }
    toast.success(`${selectedIds.size} barang dihapus`)
    setBulkDeleteOpen(false)
    exitSelectMode()
    reload()
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
  const isFiltering = search.trim() !== "" || catIds.length > 0 || lowStock || favOnly

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
            <p className="truncate text-sm font-bold text-ink">{fmtRp(summary.stockValue)}</p>
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
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border outline-none transition-colors",
              catOpen || catIds.length > 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-hairline bg-canvas text-ink-muted active:bg-canvas-soft"
            )}
            aria-label="Filter kategori"
            title={catIds.length > 0 ? `Kategori (${catIds.length})` : "Filter kategori"}
          >
            <Filter className="size-5" />
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
        <button
          type="button"
          onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          aria-label={view === "grid" ? "Tampilan daftar" : "Tampilan grid"}
          title={view === "grid" ? "Tampilan daftar" : "Tampilan grid"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas text-ink-muted transition-colors active:bg-canvas"
        >
          {view === "grid" ? <List className="size-5" /> : <Grid className="size-5" />}
        </button>
        {canManage && (
          <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
            <PopoverTrigger
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors active:bg-canvas-soft"
              aria-label="Aksi barang"
              title="Aksi barang"
            >
              <DotsHorizontalRounded className="size-5" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1">
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false)
                  setAddProductOpen(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft"
              >
                <Plus className="size-4 text-ink-faint" />
                <span className="flex-1">Tambah Barang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false)
                  setBulkOpen(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft"
              >
                <Upload className="size-4 text-ink-faint" />
                <span className="flex-1">Upload Massal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false)
                  setEditOpen(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft"
              >
                <Pencil className="size-4 text-ink-faint" />
                <span className="flex-1">Edit Massal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false)
                  if (selectMode) exitSelectMode()
                  else setSelectMode(true)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm active:bg-canvas-soft"
              >
                {selectMode ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <CheckCircle className="size-4 text-ink-faint" />
                )}
                <span className="flex-1">{selectMode ? "Selesai Pilih" : "Pilih Banyak"}</span>
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {(catIds.length > 0 || lowStock || favOnly) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {favOnly && (
            <Badge variant="default" className="gap-1 rounded-full bg-accent-orange">
              Favorit
              <button
                type="button"
                onClick={() => setFavOnly(false)}
                className="-mr-0.5 flex size-4 items-center justify-center rounded-full hover:bg-primary-foreground/20"
                aria-label="Hapus filter favorit"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
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
              setFavOnly(false)
            }}
            className="text-xs text-ink-muted active:text-ink"
          >
            Hapus semua
          </button>
        </div>
      )}

      {selectMode && (
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-canvas p-2.5">
          <p className="min-w-0 flex-1 truncate text-sm text-ink">
            <span className="font-bold text-primary">{selectedIds.size}</span> dipilih
          </p>
          <Button
            variant="outline"
            className="rounded-full px-3"
            onClick={exitSelectMode}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            className="rounded-full px-4 gap-1.5"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash className="size-4" />
            Hapus
          </Button>
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
        <div className="py-12 text-center">
          {isFiltering ? (
            <p className="text-sm text-ink-faint">Barang tidak ditemukan</p>
          ) : (
            <div className="px-4">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-canvas-soft text-ink-faint">
                <Package className="size-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">Belum ada barang</p>
              <p className="mt-1 text-xs text-ink-muted">
                Tambahkan produk jualan pertama agar bisa langsung dipakai di halaman kasir.
              </p>
              {canManage ? (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <ProductDialog product={null} onSaved={reload}>
                    <Button className="rounded-full px-4">
                      <Plus className="size-4" />
                      Tambah Barang
                    </Button>
                  </ProductDialog>
                  <Link href="/bantuan" className="text-xs font-medium text-primary">
                    Cara menambah barang
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-faint">Hubungi pemilik toko untuk menambah barang.</p>
              )}
            </div>
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
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border bg-canvas shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors",
                  p.stock <= 0 ? "border-destructive/20 bg-canvas-soft/60" : "border-hairline",
                  selectMode && selectedIds.has(p.id) && "border-primary ring-1 ring-primary"
                )}
              >
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(p.id)}
                    aria-label={selectedIds.has(p.id) ? `Batalkan pilihan ${p.name}` : `Pilih ${p.name}`}
                    className={cn(
                      "absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full border-2 bg-canvas/90 shadow-sm",
                      selectedIds.has(p.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-ink-faint text-transparent"
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggleSelect(p.id) : setSelected(p))}
                  className="flex flex-1 flex-col text-left active:bg-canvas-soft"
                >
                  <ProductThumb
                    p={p}
                    showCategory
                    className="aspect-[4/3] w-full rounded-none"
                    iconClassName="size-8"
                  />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="space-y-1">
                      <p className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-snug text-ink">
                        {p.name}
                      </p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {hasVariants(p) && <span className="font-semibold text-primary">Varian</span>}
                        {hasVariants(p) && (p.categories?.name || p.sku) && <span> · </span>}
                        {p.categories?.name ? p.categories.name : p.sku ? `SKU ${p.sku}` : p.unit || "pcs"}
                      </p>
                    </div>
                    <div className="mt-auto space-y-2">
                      <ProductPrice
                        price={net}
                        original={disc > 0 ? p.price_sell : undefined}
                        className="block"
                      />
                      <StockBadge stock={p.stock} min={p.min_stock} />
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-1 border-t border-hairline px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/10"
                  >
                    Lihat Produk
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <ProductDialog product={p} onSaved={reload}>
                        <button className="rounded-lg px-2 py-1.5 text-ink-muted active:bg-canvas-soft" aria-label={`Edit ${p.name}`}>
                          <Pencil className="size-4" />
                        </button>
                      </ProductDialog>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="rounded-lg px-2 py-1.5 text-ink-muted active:bg-canvas-soft"
                        aria-label={`Hapus ${p.name}`}
                      >
                        <Trash className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
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
                className={cn(
                  "flex items-center gap-1.5 rounded-2xl border bg-canvas p-2.5 transition-colors",
                  p.stock <= 0 ? "border-destructive/20 bg-canvas-soft/60" : "border-hairline",
                  selectMode && selectedIds.has(p.id) && "border-primary ring-1 ring-primary"
                )}
              >
                {selectMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(p.id)}
                    aria-label={selectedIds.has(p.id) ? `Batalkan pilihan ${p.name}` : `Pilih ${p.name}`}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                      selectedIds.has(p.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-ink-faint text-transparent"
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggleSelect(p.id) : setSelected(p))}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left active:bg-canvas-soft"
                >
                  <ProductThumb
                    p={p}
                    className="size-14 rounded-xl"
                    iconClassName="size-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{p.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {hasVariants(p) && <span className="font-medium text-primary">Varian</span>}
                      {hasVariants(p) &&
                        (p.categories?.name || (p.unit && p.unit !== "pcs") || p.sku) && (
                          <span> · </span>
                        )}
                      {p.categories?.name ? `${p.categories.name} · ` : ""}
                      {p.unit && p.unit !== "pcs" ? `${p.unit} · ` : ""}
                      {p.sku ? `SKU ${p.sku}` : !hasVariants(p) && !p.categories?.name ? p.unit || "pcs" : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-primary">{fmtRp(net)}</p>
                      {disc > 0 && (
                        <p className="text-[11px] text-ink-faint line-through">
                          {fmtRp(p.price_sell)}
                        </p>
                      )}
                      <StockBadge stock={p.stock} min={p.min_stock} />
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="rounded-lg px-2 py-1.5 text-xs font-semibold text-primary active:bg-primary/10"
                  >
                    Lihat
                  </button>
                  {canManage && (
                    <>
                    <ProductDialog product={p} onSaved={reload}>
                      <button className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft" aria-label={`Edit ${p.name}`}>
                        <Pencil className="size-4" />
                      </button>
                    </ProductDialog>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                      aria-label={`Hapus ${p.name}`}
                    >
                      <Trash className="size-4" />
                    </button>
                    </>
                  )}
                  </div>
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
              <DrawerTitle className="sr-only">{selected.name}</DrawerTitle>
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

                {(() => {
                  const disc = discountOf(selected)
                  const net = selected.price_sell - disc
                  return (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-primary">
                          {fmtRp(net)}
                        </p>
                        {disc > 0 && (
                          <span className="text-sm text-ink-faint line-through">
                            {fmtRp(selected.price_sell)}
                          </span>
                        )}
                      </div>
                      {disc > 0 && (
                        <p className="mt-1 text-xs font-semibold text-accent-orange">
                          Diskon aktif -{fmtRp(disc)}
                        </p>
                      )}
                    </div>
                  )
                })()}

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
                      {fmtRp(selected.price_buy)}
                    </span>
                  </div>
                  {selected.price_buy > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Margin</span>
                      <span className="text-ink">
                        {fmtRp(selected.price_sell - selected.price_buy)}
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

                {variantsProductId === selected.id && variants.length > 0 && (
                  <div className="rounded-xl bg-canvas-soft p-3">
                    <p className="mb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Varian
                    </p>
                    <div className="space-y-1.5">
                      {variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-ink">{v.name}</span>
                          <span className="shrink-0 font-medium text-ink">
                            {fmtRp(v.price_sell)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !o && setBulkDeleteOpen(false)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus {selectedIds.size} barang?</DialogTitle>
            <DialogDescription>
              Barang yang dipilih akan dihapus permanen beserta varian dan riwayat
              stoknya, dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
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
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        product={null}
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
      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSaved={reload}
      />
      <BulkEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={reload}
        selectedIds={selectedIds}
      />
    </div>
  )
}
