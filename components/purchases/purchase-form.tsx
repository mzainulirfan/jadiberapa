"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSuppliers, getProducts, type BxSupplier } from "@/lib/db/queries"
import type { BxProduct } from "@/components/products/types"
import { createPurchase } from "@/lib/actions/purchases"
import { X, Search, ChevronDown, Trash, Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`
const onlyDigits = (s: string) => s.replace(/\D/g, "")

type DraftItem = {
  key: string
  product_id: string
  name: string
  unit: string | null
  qty: number
  price_buy: number
}

export function PurchaseForm({
  open,
  onOpenChange,
  initialSupplierId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSupplierId?: string | null
  onSaved?: () => void
}) {
  const [suppliers, setSuppliers] = useState<BxSupplier[]>([])
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId ?? null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BxProduct[]>([])
  const [paidInput, setPaidInput] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const searchSeq = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function loadInitial() {
    const seq = ++searchSeq.current
    getProducts({ limit: 8 }).then(({ data }) => {
      if (seq === searchSeq.current) setResults(data)
    })
  }

  useEffect(() => {
    getSuppliers().then(setSuppliers)
    loadInitial()
  }, [])

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    },
    []
  )

  function handleSearch(value: string) {
    setQuery(value)
    const q = value.trim()
    if (!q) {
      loadInitial()
      return
    }
    const seq = ++searchSeq.current
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      getProducts({ search: q, limit: 8 }).then(({ data }) => {
        if (seq === searchSeq.current) setResults(data)
      })
    }, 250)
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.qty * i.price_buy, 0), [items])
  const paid = Number(onlyDigits(paidInput)) || 0
  const remaining = Math.max(0, total - paid)
  const selectedSupplier = suppliers.find((s) => s.id === supplierId)

  function addProduct(p: BxProduct) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id)
      if (existing) {
        return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [
        ...prev,
        { key: crypto.randomUUID(), product_id: p.id, name: p.name, unit: p.unit, qty: 1, price_buy: p.price_buy },
      ]
    })
    setQuery("")
    setResults([])
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  async function handleSave() {
    if (!supplierId) {
      toast.error("Pilih supplier terlebih dahulu")
      return
    }
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 barang")
      return
    }
    setSaving(true)
    try {
      const res = await createPurchase(
        supplierId,
        items.map((i) => ({ product_id: i.product_id, qty: i.qty, price_buy: i.price_buy })),
        paid,
        note
      )
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Pembelian dicatat")
      onOpenChange(false)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !saving && onOpenChange(o)} showSwipeHandle>
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <DrawerTitle>Tambah Pembelian</DrawerTitle>
          <DrawerClose className="-mr-1.5 rounded-full p-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Supplier */}
            <div>
              <p className="mb-1.5 text-xs text-ink-muted">Supplier</p>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas px-3 text-sm text-ink outline-none transition-colors active:bg-canvas-soft data-[popup-open]:bg-canvas-soft">
                  <span className={cn("truncate", !selectedSupplier && "text-ink-faint")}>
                    {selectedSupplier?.name ?? "Pilih supplier"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-ink-muted" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[220px]">
                  <DropdownMenuRadioGroup value={supplierId ?? ""} onValueChange={(v) => setSupplierId(v || null)}>
                    {suppliers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-ink-faint">
                        Belum ada supplier. Tambahkan lewat menu Supplier.
                      </div>
                    ) : (
                      suppliers.map((s) => (
                        <DropdownMenuRadioItem key={s.id} value={s.id} closeOnClick>
                          {s.name}
                        </DropdownMenuRadioItem>
                      ))
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tambah item */}
            <div>
              <p className="mb-1.5 text-xs text-ink-muted">Barang</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                  <Search className="size-4" />
                </span>
                <Input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Cari barang..."
                  className="h-10 rounded-xl pl-9"
                />
                {query.trim() || results.length > 0 ? (
                  <div className="absolute inset-x-0 top-11 z-10 max-h-56 overflow-y-auto rounded-xl border border-hairline bg-canvas shadow-lg">
                    {results.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-ink-faint">Barang tidak ditemukan</p>
                    ) : (
                      <>
                        {results.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-canvas-soft"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
                              <Package className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                            <span className="shrink-0 text-xs text-ink-faint">
                              {p.stock} stok · {fmtRp(p.price_buy)}
                            </span>
                          </button>
                        ))}
                        {query.trim() === "" && results.length >= 8 && (
                          <p className="border-t border-hairline px-3 py-2 text-center text-[11px] text-ink-faint">
                            Ketik untuk mencari lebih banyak
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Item list */}
            {items.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-faint">Belum ada barang di nota.</p>
            ) : (
              <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
                {items.map((item) => (
                  <div key={item.key} className="flex items-start gap-2.5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-hairline">
                          <button
                            type="button"
                            onClick={() => updateItem(item.key, { qty: Math.max(0, item.qty - 1) })}
                            className="px-2.5 py-1.5 text-ink-muted active:bg-canvas-soft"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold text-ink">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItem(item.key, { qty: item.qty + 1 })}
                            className="px-2.5 py-1.5 text-ink-muted active:bg-canvas-soft"
                          >
                            +
                          </button>
                        </div>
                        {item.unit && <span className="text-xs text-ink-faint">{item.unit}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center overflow-hidden rounded-lg border border-hairline">
                        <span className="px-2 text-xs text-ink-faint">Rp</span>
                        <input
                          inputMode="numeric"
                          value={item.price_buy.toLocaleString("id-ID")}
                          onChange={(e) =>
                            updateItem(item.key, { price_buy: Number(onlyDigits(e.target.value)) || 0 })
                          }
                          className="w-24 bg-transparent py-1.5 pr-2 text-right text-sm font-semibold text-ink outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                        aria-label="Hapus item"
                        className="rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                      >
                        <Trash className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                  <span className="text-sm text-ink-muted">Total Nota</span>
                  <span className="text-base font-bold text-ink">{fmtRp(total)}</span>
                </div>
              </div>
            )}

            {/* Pembayaran */}
            <div className="rounded-xl border border-hairline bg-canvas p-3">
              <label htmlFor="pur-paid" className="mb-1 block text-xs text-ink-muted">
                Dibayar sekarang <span className="text-ink-faint">(0 = utang penuh)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-hairline">
                  <span className="px-2 text-xs text-ink-faint">Rp</span>
                  <input
                    id="pur-paid"
                    inputMode="numeric"
                    placeholder="0"
                    value={paid ? paid.toLocaleString("id-ID") : ""}
                    onChange={(e) => setPaidInput(onlyDigits(e.target.value))}
                    className="h-10 w-full bg-transparent px-2 text-sm font-semibold text-ink outline-none placeholder:text-ink-faint"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-lg"
                  disabled={total <= 0}
                  onClick={() => setPaidInput(String(total))}
                >
                  Lunasi
                </Button>
              </div>
              {total > 0 && remaining > 0 && (
                <p className="mt-2 text-xs text-destructive">Sisa utang ke supplier: {fmtRp(remaining)}</p>
              )}
            </div>

            <div>
              <label htmlFor="pur-note" className="mb-1 block text-xs text-ink-muted">
                Catatan <span className="text-ink-faint">(opsional)</span>
              </label>
              <Input
                id="pur-note"
                placeholder="Contoh: PO mingguan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="h-11 w-full rounded-full text-base"
              disabled={saving || items.length === 0}
              onClick={handleSave}
            >
              {saving ? "Menyimpan..." : `Simpan Pembelian${total > 0 ? ` · ${fmtRp(total)}` : ""}`}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
