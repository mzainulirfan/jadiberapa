"use client"

import { useEffect, useRef, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  X,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fmtRp } from "@/lib/format"
import { getAllProducts } from "@/lib/db/queries"
import { bulkUpdateProducts } from "@/lib/actions/products"
import {
  parseProductEdit,
  productsToEditCsv,
  type EditProductRow,
} from "@/lib/import/products"

// Kolom yang BOLEH diubah lewat edit massal.
const EDITABLE_COLUMNS = ["Nama", "Kategori", "Harga Beli", "Harga Jual", "Stok Minimum", "Satuan", "SKU", "Barcode"]

function downloadBlob(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BulkEditDialog({
  open,
  onOpenChange,
  onSaved,
  selectedIds,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
  selectedIds: Set<string>
}) {
  const [text, setText] = useState("")
  const [preview, setPreview] = useState<EditProductRow[] | null>(null)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset form saat drawer dibuka */
      setText("")
      setPreview(null)
      setHeaderError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open])

  function runPreview(content: string) {
    const { rows, headerError: err } = parseProductEdit(content)
    setHeaderError(err ?? null)
    setPreview(rows)
    if (err) toast.error(err)
  }

  async function handleExport() {
    try {
      setExporting(true)
      const products = await getAllProducts(selectedIds.size ? [...selectedIds] : undefined)
      const rows = products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.categories?.name ?? "",
        priceBuy: p.price_buy,
        priceSell: p.price_sell,
        minStock: p.min_stock,
        unit: p.unit || "pcs",
        sku: p.sku ?? "",
        barcode: p.barcode ?? "",
      }))
      downloadBlob(
        "edit-barang.csv",
        productsToEditCsv(rows, selectedIds.size ? [...selectedIds] : undefined)
      )
      toast.success(
        selectedIds.size
          ? `${selectedIds.size} barang (pilihan) diunduh`
          : `${rows.length} barang diunduh`
      )
    } catch {
      toast.error("Gagal mengunduh data barang")
    } finally {
      setExporting(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    runPreview(content)
    e.target.value = ""
  }

  const validRows = (preview ?? []).filter((r) => !r.error)
  const errorRows = (preview ?? []).filter((r) => r.error)

  async function handleSave() {
    if (validRows.length === 0) return
    setSaving(true)
    try {
      const { error, updated, errors } = await bulkUpdateProducts(validRows)
      if (error) {
        toast.error(error)
        return
      }
      if (errors.length) toast.error(errors[0])
      else toast.success(`${updated} barang diperbarui`)
      onSaved?.()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <div>
            <DrawerTitle>Edit Barang Massal</DrawerTitle>
          </div>
          <DrawerClose className="-mr-1.5 rounded-full p-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-5" />
          </DrawerClose>
        </DrawerHeader>

        {preview === null ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-xl border border-hairline bg-canvas p-3.5 text-xs text-ink-muted">
                <p className="font-semibold text-ink">Cara pakai</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>Unduh data barang (CSV) di bawah.</li>
                  <li>Buka di Excel, ubah kolom yang boleh (lihat daftar), lalu simpan sebagai CSV.</li>
                  <li>Unggah hasilnya dan ketuk <b>Terapkan</b>.</li>
                </ol>
                <p className="mt-1.5 font-medium text-ink">Boleh diubah</p>
                <p className="mt-0.5">{EDITABLE_COLUMNS.join(", ")}.</p>
                <p className="mt-1.5 font-medium text-ink">Tidak boleh diubah</p>
                <p className="mt-0.5">
                  Kolom <b>ID</b> hanya penanda baris — jangan diganti. <b>Stok</b> tidak ada di file; ubah
                  stok lewat menu Kelola Stok agar riwayat tercatat.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleExport} disabled={exporting}>
                  <Download className="size-3.5" />
                  {exporting ? "Menyiapkan..." : selectedIds.size ? `Unduh ${selectedIds.size} Barang (Pilihan)` : "Unduh Semua Barang"}
                </Button>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-3.5" />
                    Unggah Hasil Edit
                  </Button>
                  <Button variant="ghost" onClick={() => runPreview(text)}>
                    Pratinjau
                  </Button>
                </div>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Atau tempel isi CSV hasil edit di sini, lalu ketuk Pratinjau."
                className="min-h-28 font-mono text-xs"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-full bg-accent-green/15 px-2.5 py-1 text-xs font-semibold text-accent-green">
                  <CheckCircle className="size-3.5" /> {validRows.length} siap diperbarui
                </span>
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                    <XCircle className="size-3.5" /> {errorRows.length} error
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="ml-auto text-xs font-medium text-primary"
                >
                  Ubah data
                </button>
              </div>

              {headerError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{headerError}</span>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-xl border border-hairline bg-canvas">
                {preview.map((row) => (
                  <div
                    key={row.line}
                    className={cn(
                      "flex items-center justify-between gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0",
                      row.error && "bg-destructive/5"
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn("truncate text-sm font-medium", row.error ? "text-destructive" : "text-ink")}>
                        {row.line}. {row.name || "(nama kosong)"}
                      </p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {[row.category, fmtRp(row.priceSell), `min ${row.minStock}`, row.unit]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {row.error && <p className="text-[11px] font-medium text-destructive">{row.error}</p>}
                    </div>
                    {!row.error && <span className="size-2 shrink-0 rounded-full bg-accent-green" />}
                  </div>
                ))}
              </div>
            </div>
            <DrawerFooter>
              <Button
                className="w-full"
                disabled={validRows.length === 0 || saving}
                onClick={handleSave}
              >
                {saving ? "Menyimpan..." : `Terapkan ${validRows.length} Perubahan`}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}