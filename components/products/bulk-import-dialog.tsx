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
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fmtRp } from "@/lib/format"
import { bulkCreateProducts } from "@/lib/actions/products"
import {
  parseProductImport,
  productImportTemplateCsv,
  type ImportProductRow,
} from "@/lib/import/products"

const MAX_ROWS = 1000

function downloadTemplate() {
  const blob = new Blob([productImportTemplateCsv()], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "template-barang.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const [text, setText] = useState("")
  const [preview, setPreview] = useState<ImportProductRow[] | null>(null)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
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
    const { rows, headerError: err } = parseProductImport(content)
    setHeaderError(err ?? null)
    setPreview(rows)
    if (err) toast.error(err)
  }

  function handlePaste() {
    if (!text.trim()) {
      toast.error("Tempel data barang terlebih dahulu.")
      return
    }
    runPreview(text)
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

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const { created, errors } = await bulkCreateProducts(validRows)
      if (errors.length) {
        toast.error(errors[0])
        return
      }
      toast.success(`${created} barang berhasil diimport`)
      onSaved?.()
      onOpenChange(false)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <div>
            <DrawerTitle>Upload Barang Massal</DrawerTitle>
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
                  <li>Salin baris dari Excel/Google Sheets, lalu tempel di bawah — <b>atau</b> unggah file CSV.</li>
                  <li>Ketuk <b>Pratinjau</b> untuk melihat hasil & kesalahan sebelum disimpan.</li>
                  <li>Kolom wajib: <b>Nama</b> dan <b>Harga Jual</b>. Maksimal {MAX_ROWS} baris.</li>
                </ol>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "Tempel di sini. Contoh:\n\nIndomie Goreng\tMakanan\t2500\t3000\t50\t5\tpcs\tIDM-001\t8990000000000\n\n(Pisahkan kolom dengan tab, koma, atau titik-koma; baris pertama = nama kolom)"
                }
                className="min-h-40 font-mono text-xs"
              />

              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" />
                  Unggah File CSV
                </Button>
                <Button variant="ghost" onClick={downloadTemplate}>
                  Unduh Template
                </Button>
              </div>
            </div>
            <DrawerFooter className="flex-row">
              <Button className="flex-1" onClick={handlePaste}>
                Pratinjau
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-full bg-accent-green/15 px-2.5 py-1 text-xs font-semibold text-accent-green">
                  <CheckCircle className="size-3.5" /> {validRows.length} valid
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
                        {[row.category, fmtRp(row.priceSell), `stok ${row.stock}`, row.unit]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {row.error && <p className="text-[11px] font-medium text-destructive">{row.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DrawerFooter>
              <Button
                className="w-full"
                disabled={validRows.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? "Mengimport..." : `Import ${validRows.length} Barang`}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}