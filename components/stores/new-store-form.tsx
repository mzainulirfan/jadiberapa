"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Package, Tag } from "@/components/ui/icons"
import { TemplatePicker } from "@/components/templates/template-picker"
import { getStoreTemplate } from "@/lib/templates"
import { storeTemplateOptions } from "@/lib/templates/options"
import { invalidateAllDataCaches } from "@/lib/db/queries"
import { createStoreForCurrentUser } from "@/lib/actions/stores"

export function NewStoreForm() {
  const [storeName, setStoreName] = useState("")
  const [templateKey, setTemplateKey] = useState("kelontong")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedTemplate = getStoreTemplate(templateKey)
  const selectedOption = storeTemplateOptions.find((option) => option.key === templateKey)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!storeName.trim()) {
      setError("Masukkan nama toko")
      return
    }

    setLoading(true)
    const res = await createStoreForCurrentUser(storeName.trim(), templateKey)
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    invalidateAllDataCaches()
    window.location.assign("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.625px] text-ink">Buat toko baru</h1>
        <p className="text-sm text-ink-muted">Siapkan toko baru untuk akun Anda.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="store-name" className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Nama toko
          </label>
          <Input
            id="store-name"
            placeholder="Contoh: Warung Berkah"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            autoComplete="organization"
            required
          />
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Mulai dengan</p>
            <p className="mt-1 text-xs text-ink-muted">
              Pilih isi awal agar toko siap digunakan. Semua data bisa diubah nanti.
            </p>
          </div>
          <TemplatePicker value={templateKey} onChange={setTemplateKey} compact />

          <div className="rounded-xl border border-hairline bg-canvas-soft p-3">
            <p className="text-sm font-semibold text-ink">{selectedOption?.name ?? "Isi awal toko"}</p>
            {selectedTemplate ? (
              <div className="mt-2 flex gap-3 text-xs font-medium text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" />
                  {selectedTemplate.categories.length} kategori
                </span>
                <span className="flex items-center gap-1.5">
                  <Package className="size-3.5 text-primary" />
                  {selectedTemplate.products.length} produk
                </span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">
                Tanpa kategori dan produk contoh. Data dapat ditambahkan setelah toko dibuat.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? "Membuat toko..." : "Buat Toko"}
      </Button>
    </form>
  )
}
