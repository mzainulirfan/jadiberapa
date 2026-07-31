"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { addStock, adjustStock } from "@/lib/actions/products"
import { getStockMovements, type BxStockMovement } from "@/lib/db/queries"
import type { BxProduct } from "./types"
import { X } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

const formatThousands = (raw: string) => (raw ? Number(raw).toLocaleString("id-ID") : "")
const onlyDigits = (s: string) => s.replace(/\D/g, "")

type Mode = "in" | "adjust"

const moveMeta: Record<BxStockMovement["type"], { label: string; className: string }> = {
  in: { label: "Masuk", className: "text-emerald-600" },
  out: { label: "Keluar", className: "text-ink-muted" },
  adjust: { label: "Opname", className: "text-primary" },
}

type Props = {
  product: BxProduct | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}

export function StockAdjustDialog({ product, open, onOpenChange, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("in")
  const [qty, setQty] = useState("")
  const [priceBuy, setPriceBuy] = useState("")
  const [newStock, setNewStock] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [movements, setMovements] = useState<BxStockMovement[]>([])

  const loadMovements = useCallback((pid: string) => {
    getStockMovements(pid).then(setMovements)
  }, [])

  useEffect(() => {
    if (open && product) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset form ke nilai awal saat drawer dibuka */
      setMode("in")
      setQty("")
      setPriceBuy(product.price_buy ? String(product.price_buy) : "")
      setNewStock(String(product.stock))
      setNote("")
      /* eslint-enable react-hooks/set-state-in-effect */
      loadMovements(product.id)
    }
  }, [open, product, loadMovements])

  if (!product) return null

  async function handleSave() {
    if (!product) return
    setSaving(true)
    try {
      if (mode === "in") {
        const q = Number(qty) || 0
        if (q <= 0) {
          toast.error("Isi jumlah stok masuk.")
          return
        }
        const pb = priceBuy ? Number(priceBuy) : undefined
        const res = await addStock(product.id, q, pb, note.trim() || undefined)
        if (res?.error) {
          toast.error(res.error)
          return
        }
        toast.success(`Stok masuk ${q} tercatat`)
      } else {
        const target = Number(newStock) || 0
        const res = await adjustStock(product.id, target, note.trim() || undefined)
        if (res?.error) {
          toast.error(res.error)
          return
        }
        toast.success("Stok diperbarui")
      }
      onSaved?.()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const nextStock =
    mode === "in"
      ? product.stock + (Number(qty) || 0)
      : Number(newStock) || 0
  const delta = nextStock - product.stock

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <div>
            <DrawerTitle className="text-lg font-bold">Kelola Stok</DrawerTitle>
            <p className="truncate text-xs text-ink-muted">{product.name}</p>
          </div>
          <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-canvas-soft px-3 py-2.5 text-sm">
              <span className="text-ink-muted">Stok saat ini</span>
              <span className="font-bold text-ink">{product.stock}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-full bg-canvas-soft p-1">
              {(["in", "adjust"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full py-1.5 text-sm font-medium transition-colors",
                    mode === m ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
                  )}
                >
                  {m === "in" ? "Stok Masuk" : "Opname"}
                </button>
              ))}
            </div>

            {mode === "in" ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="stock-in-qty" className="text-xs text-ink-muted mb-1 block">
                    Jumlah Masuk
                  </label>
                  <Input
                    id="stock-in-qty"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatThousands(qty)}
                    onChange={(e) => setQty(onlyDigits(e.target.value))}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="stock-in-buy" className="text-xs text-ink-muted mb-1 block">
                    Harga Beli Baru <span className="text-ink-faint">(opsional)</span>
                  </label>
                  <InputGroup>
                    <InputGroupAddon>Rp</InputGroupAddon>
                    <InputGroupInput
                      id="stock-in-buy"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatThousands(priceBuy)}
                      onChange={(e) => setPriceBuy(onlyDigits(e.target.value))}
                    />
                  </InputGroup>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="stock-opname" className="text-xs text-ink-muted mb-1 block">
                  Stok Hasil Hitung Ulang
                </label>
                <Input
                  id="stock-opname"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatThousands(newStock)}
                  onChange={(e) => setNewStock(onlyDigits(e.target.value))}
                  autoFocus
                />
              </div>
            )}

            <div>
              <label htmlFor="stock-note" className="text-xs text-ink-muted mb-1 block">
                Catatan <span className="text-ink-faint">(opsional)</span>
              </label>
              <Input
                id="stock-note"
                placeholder={mode === "in" ? "Contoh: beli dari supplier" : "Contoh: rusak, hilang, hitung ulang"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2.5 text-sm">
              <span className="text-ink-muted">Stok setelah</span>
              <span className="font-bold text-ink">
                {nextStock}
                {delta !== 0 && (
                  <span className={cn("ml-1.5 text-xs font-medium", delta > 0 ? "text-emerald-600" : "text-destructive")}>
                    ({delta > 0 ? "+" : ""}{delta})
                  </span>
                )}
              </span>
            </div>

            {movements.length > 0 && (
              <div className="rounded-xl border border-hairline">
                <p className="border-b border-hairline px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Riwayat Stok
                </p>
                <ul className="divide-y divide-hairline">
                  {movements.map((m) => {
                    const meta = moveMeta[m.type]
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className={cn("font-medium", meta.className)}>{meta.label}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {m.note || format(new Date(m.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                          </p>
                        </div>
                        <span className={cn("shrink-0 font-semibold tabular-nums", m.qty > 0 ? "text-emerald-600" : "text-ink-muted")}>
                          {m.qty > 0 ? "+" : ""}{m.qty}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="w-full rounded-full h-11 text-base"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Menyimpan..." : mode === "in" ? "Simpan Stok Masuk" : "Simpan Opname"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
