"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { updateSetting } from "@/lib/actions/settings"
import { getSettings, getCurrentStoreCode, invalidateSettings, invalidateStoreProfile } from "@/lib/db/queries"
import {
  Store,
  LocationPin,
  Phone,
  Qr,
  Wallet,
  Copy,
  Check,
  Share,
  Receipt,
  Tag,
  Refresh,
  AlertTriangle,
} from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { DangerZone } from "@/components/settings/danger-zone"

const APP_VERSION = "Saberaha v1.0.0"
const SAVE_DEBOUNCE_MS = 1200

type FieldStatus = "saving" | "saved" | "error"

type FieldDef = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  placeholder: string
  multiline?: boolean
  inputMode?: "tel" | "text"
  type?: "number"
  hint?: string
}

const STORE_FIELDS: FieldDef[] = [
  { key: "store_name", label: "Nama Toko", icon: Store, placeholder: "Toko Saya" },
  { key: "store_address", label: "Alamat", icon: LocationPin, placeholder: "Jl. ...", multiline: true },
  { key: "store_phone", label: "Telepon", icon: Phone, placeholder: "08xxx", inputMode: "tel" },
]

const STORE_KEYS = STORE_FIELDS.map((f) => f.key)
const PAYMENT_KEYS = ["qris_payload", "dana_number"]
const NOTA_KEYS = ["show_nota_number", "receipt_footer"]
const PREFERENSI_KEYS = ["default_min_stock"]

// Validasi ringan payload EMV QRIS: awalan PFI + struktur TLV + CRC (ID 63).
function validateQris(payload: string): string | null {
  const p = payload.trim()
  if (!p) return null
  if (p.length < 10) return "Kode terlihat terlalu pendek untuk QRIS."
  if (!/^\d+$/.test(p)) return "Kode QRIS hanya boleh berisi angka."
  if (!p.startsWith("0002")) return "Kode harus diawali 000201/000202 (Payload Format Indicator)."
  let i = 0
  let hasCrc = false
  while (i + 4 <= p.length) {
    const tag = p.slice(i, i + 2)
    const len = parseInt(p.slice(i + 2, i + 4), 10)
    if (Number.isNaN(len)) return "Struktur kode tidak valid."
    const end = i + 4 + len
    if (end > p.length) return "Panjang kode tidak sesuai."
    if (tag === "63") hasCrc = true
    i = end
  }
  if (!hasCrc) return "CRC (ID 63) tidak ditemukan — pastikan kode lengkap."
  return null
}

function StatusBadge({ status, onRetry }: { status?: FieldStatus; onRetry?: () => void }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-ink-faint">
        <Refresh className="size-3 animate-spin" /> Menyimpan…
      </span>
    )
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-primary">
        <Check className="size-3" /> Tersimpan
      </span>
    )
  }
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-[11px] font-medium text-destructive active:opacity-70"
      >
        <AlertTriangle className="size-3" /> Gagal · Ulangi
      </button>
    )
  }
  return null
}

function SectionCard({
  status,
  onRetry,
  children,
}: {
  status?: FieldStatus
  onRetry?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      {status && (
        <div className="flex justify-end px-1">
          <StatusBadge status={status} onRetry={onRetry} />
        </div>
      )}
      <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">{children}</div>
    </section>
  )
}

function FieldRow({
  def,
  value,
  status,
  onChange,
  onBlur,
  onReset,
}: {
  def: FieldDef
  value: string
  status?: FieldStatus
  onChange: (key: string, value: string) => void
  onBlur?: (key: string, value: string) => void
  onReset: () => void
}) {
  const Icon = def.icon
  const hasValue = value.trim().length > 0
  return (
    <div className="p-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={def.key} className="flex items-center gap-2 text-xs text-ink-muted">
          <Icon className="size-3.5" /> {def.label}
        </label>
        <span className="flex-1" />
        {hasValue && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Kosongkan ${def.label}`}
            className="flex size-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink-muted active:bg-canvas-soft"
          >
            <Refresh className="size-3.5" />
          </button>
        )}
        <StatusBadge status={status} />
      </div>
      {def.multiline ? (
        <Textarea
          id={def.key}
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(def.key, e.target.value)}
          onBlur={onBlur ? () => onBlur(def.key, value) : undefined}
          className="min-h-[60px]"
        />
      ) : (
        <Input
          id={def.key}
          type={def.type ?? "text"}
          value={value}
          placeholder={def.placeholder}
          inputMode={def.inputMode}
          onChange={(e) => onChange(def.key, e.target.value)}
          onBlur={onBlur ? () => onBlur(def.key, value) : undefined}
        />
      )}
      {def.hint && <p className="mt-1.5 text-[11px] text-ink-faint">{def.hint}</p>}
    </div>
  )
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<Record<string, FieldStatus>>({})
  const savedRef = useRef<Record<string, string>>({})
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const clearRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let active = true
    const debounce = debounceRef.current
    const clears = clearRef.current
    Promise.all([getSettings(), getCurrentStoreCode()]).then(([s, c]) => {
      if (!active) return
      setSettings(s)
      savedRef.current = s
      setCode(c)
      setLoading(false)
    })
    return () => {
      active = false
      Object.values(debounce).forEach(clearTimeout)
      Object.values(clears).forEach(clearTimeout)
    }
  }, [])

  async function saveNow(key: string, raw: string) {
    const value = raw.trim()
    if (value === (savedRef.current[key] ?? "")) {
      setSaveState((prev) => ({ ...prev, [key]: "saved" }))
      scheduleClear(key)
      return
    }
    setSaveState((prev) => ({ ...prev, [key]: "saving" }))
    const res = await updateSetting(key, value)
    if (res?.error) {
      setSaveState((prev) => ({ ...prev, [key]: "error" }))
      toast.error("Gagal menyimpan perubahan")
      return
    }
    savedRef.current = { ...savedRef.current, [key]: value }
    setSettings((prev) => ({ ...prev, [key]: value }))
    // Segarkan cache settings (& profil toko) agar pembacaan berikutnya tidak basi.
    invalidateSettings()
    if (key === "store_name" || key === "store_phone") invalidateStoreProfile()
    setSaveState((prev) => ({ ...prev, [key]: "saved" }))
    scheduleClear(key)
  }

  function scheduleClear(key: string) {
    if (clearRef.current[key]) clearTimeout(clearRef.current[key])
    clearRef.current[key] = setTimeout(() => {
      setSaveState((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 1800)
  }

  function handleChange(key: string, raw: string) {
    setSettings((prev) => ({ ...prev, [key]: raw }))
    setSaveState((prev) => ({ ...prev, [key]: "saving" }))
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(() => saveNow(key, raw), SAVE_DEBOUNCE_MS)
  }

  function handleBlur(key: string, raw: string) {
    // Simpan segera saat meninggalkan kolom agar tidak menunggu debounce.
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key])
    saveNow(key, raw)
  }

  function resetField(key: string) {
    handleChange(key, "")
  }

  function retrySection(keys: string[]) {
    for (const k of keys) {
      if (saveState[k] === "error") handleChange(k, settings[k] ?? "")
    }
  }

  function sectionStatus(keys: string[]): FieldStatus | undefined {
    const states = keys.map((k) => saveState[k]).filter(Boolean) as FieldStatus[]
    if (states.includes("error")) return "error"
    if (states.includes("saving")) return "saving"
    if (states.includes("saved")) return "saved"
    return undefined
  }

  async function handleShare() {
    if (!code) return
    const storeName = settings.store_name?.trim() || "Toko Saya"
    const link = `${window.location.origin}/register?code=${encodeURIComponent(code)}`
    const text = `Gabung ke toko ${storeName} di Saberaha sebagai kasir.\n\n${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Undang Kasir", text })
      } catch {
        // user cancelled
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Teks undangan disalin")
    } catch {
      toast.error("Gagal membagikan kode toko")
    }
  }

  async function handleCopyLink() {
    if (!code) return
    const link = `${window.location.origin}/register?code=${encodeURIComponent(code)}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Gagal menyalin link undangan")
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <div className="rounded-xl border border-hairline bg-canvas p-4">
            <Skeleton className="mx-auto h-10 w-32 rounded-md" />
            <Skeleton className="mx-auto mt-3 h-9 w-40 rounded-full" />
            <Skeleton className="mx-auto mt-3 size-32 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-3.5">
                <Skeleton className="mb-1.5 h-3 w-20 rounded-full" />
                <Skeleton className={i === 1 ? "h-14 w-full rounded-md" : "h-9 w-full rounded-md"} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const qris = settings.qris_payload ?? ""
  const qrisError = validateQris(qris)
  const showNota = settings.show_nota_number !== "0"
  const inviteLink = `${window.location.origin}/register?code=${encodeURIComponent(code)}`

  return (
    <div className="space-y-5 p-4">
      <Tabs defaultValue="toko" className="space-y-5">
        <div className="sticky top-0 -mx-4 -mt-4 z-10 border-b border-hairline bg-canvas/95 px-4 pt-2 pb-3 backdrop-blur-sm">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="toko" className="flex-1 justify-start px-1 after:hidden data-active:font-bold">
              <Store className="size-4" />
              <span>Toko</span>
            </TabsTrigger>
            <TabsTrigger value="pembayaran" className="flex-1 justify-start px-1 after:hidden data-active:font-bold">
              <Wallet className="size-4" />
              <span>Pembayaran</span>
            </TabsTrigger>
            <TabsTrigger value="nota" className="flex-1 justify-start px-1 after:hidden data-active:font-bold">
              <Receipt className="size-4" />
              <span>Nota</span>
            </TabsTrigger>
            <TabsTrigger value="preferensi" className="flex-1 justify-start px-1 after:hidden data-active:font-bold">
              <Tag className="size-4" />
              <span>Preferensi</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="toko" className="space-y-5">
          <div className="flex items-start gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-ink-muted">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">Pengaturan Toko</h2>
              <p className="text-xs text-ink-faint">Identitas toko, kontak, & undangan kasir.</p>
            </div>
          </div>

          <SectionCard status={sectionStatus(STORE_KEYS)} onRetry={() => retrySection(STORE_KEYS)}>
            {STORE_FIELDS.map((f) => (
              <FieldRow
                key={f.key}
                def={f}
                value={settings[f.key] ?? ""}
                status={saveState[f.key]}
                onChange={handleChange}
                onBlur={handleBlur}
                onReset={() => resetField(f.key)}
              />
            ))}
          </SectionCard>

          <SectionCard>
            <div className="p-4">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border-2 border-dashed border-hairline px-6 py-3">
                  <code className="text-lg font-bold tracking-[0.15em] text-ink">{code}</code>
                </div>
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                    {copied ? "Tersalin" : "Salin Link"}
                  </Button>
                  <Button className="flex-1" onClick={handleShare}>
                    <Share className="size-4" /> Bagikan
                  </Button>
                </div>
                {code && (
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={inviteLink} size={128} marginSize={0} />
                  </div>
                )}
                <p className="text-center text-[11px] text-ink-faint">
                  Bagikan link undangan (atau kode) ke kasir — saat mendaftar, kasir langsung
                  terhubung ke toko Anda tanpa memasukkan kode.
                </p>
              </div>
            </div>
          </SectionCard>

          <DangerZone storeName={settings.store_name?.trim() || "Toko Saya"} />
        </TabsContent>

        <TabsContent value="pembayaran" className="space-y-5">
          <div className="flex items-start gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-ink-muted">
              <Wallet className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">Metode Pembayaran</h2>
              <p className="text-xs text-ink-faint">Metode non-tunai yang tampil saat checkout.</p>
            </div>
          </div>

          <SectionCard status={sectionStatus(PAYMENT_KEYS)} onRetry={() => retrySection(PAYMENT_KEYS)}>
            <div className="p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <label htmlFor="qris_payload" className="flex items-center gap-2 text-xs text-ink-muted">
                  <Qr className="size-3.5" /> Kode QRIS
                </label>
                <span className="flex-1" />
                {qris.trim() && (
                  <button
                    type="button"
                    onClick={() => resetField("qris_payload")}
                    aria-label="Kosongkan Kode QRIS"
                    className="flex size-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink-muted active:bg-canvas-soft"
                  >
                    <Refresh className="size-3.5" />
                  </button>
                )}
                <StatusBadge status={saveState.qris_payload} />
              </div>
              <Textarea
                id="qris_payload"
                value={qris}
                placeholder="00020101021126..."
                onChange={(e) => handleChange("qris_payload", e.target.value)}
                onBlur={() => handleBlur("qris_payload", qris)}
                className="min-h-[70px] font-mono text-xs"
              />
              {qris.trim() ? (
                qrisError ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="size-3" /> {qrisError}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-canvas-soft p-3">
                    <div className="rounded-lg bg-white p-2">
                      <QRCodeSVG value={qris} size={128} marginSize={0} />
                    </div>
                    <p className="text-[11px] text-ink-faint">Pratinjau — pastikan QR bisa dipindai</p>
                  </div>
                )
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  Tempel kode QRIS statis (EMV) dari aplikasi bank / e-wallet Anda.
                </p>
              )}
            </div>

            <FieldRow
              def={{
                key: "dana_number",
                label: "Nomor DANA",
                icon: Wallet,
                placeholder: "08xxx",
                inputMode: "tel",
                hint: "Nomor tujuan pembayaran DANA yang ditampilkan saat checkout.",
              }}
              value={settings.dana_number ?? ""}
              status={saveState.dana_number}
              onChange={handleChange}
              onBlur={handleBlur}
              onReset={() => resetField("dana_number")}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="nota" className="space-y-5">
          <div className="flex items-start gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-ink-muted">
              <Receipt className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">Nota & Struk</h2>
              <p className="text-xs text-ink-faint">Tampilan nota penjualan & struk cetak.</p>
            </div>
          </div>

          <SectionCard status={sectionStatus(NOTA_KEYS)} onRetry={() => retrySection(NOTA_KEYS)}>
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">Nomor Nota di Struk</p>
                  <p className="text-[11px] text-ink-faint">Tampilkan nomor & barcode nota pada struk.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showNota}
                  onClick={() => handleChange("show_nota_number", showNota ? "0" : "1")}
                  aria-label="Tampilkan nomor nota di struk"
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    showNota ? "bg-primary" : "bg-ink/20"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      showNota && "translate-x-5"
                    )}
                  />
                </button>
              </div>
              {saveState.show_nota_number && (
                <div className="mt-2 flex justify-end">
                  <StatusBadge
                    status={saveState.show_nota_number}
                    onRetry={() => retrySection(["show_nota_number"])}
                  />
                </div>
              )}
            </div>

            <div className="p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <label htmlFor="receipt_footer" className="flex items-center gap-2 text-xs text-ink-muted">
                  <Receipt className="size-3.5" /> Teks Penutup Struk
                </label>
                <span className="flex-1" />
                <StatusBadge status={saveState.receipt_footer} />
              </div>
              <Textarea
                id="receipt_footer"
                value={settings.receipt_footer ?? ""}
                placeholder={"Terima kasih\nSampai jumpa kembali"}
                onChange={(e) => handleChange("receipt_footer", e.target.value)}
                onBlur={() => handleBlur("receipt_footer", settings.receipt_footer ?? "")}
                className="min-h-[60px]"
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">Ditampilkan di bagian bawah struk.</p>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="preferensi" className="space-y-5">
          <div className="flex items-start gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-ink-muted">
              <Tag className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">Preferensi</h2>
              <p className="text-xs text-ink-faint">Nilai bawaan untuk operasional toko.</p>
            </div>
          </div>

          <SectionCard status={sectionStatus(PREFERENSI_KEYS)} onRetry={() => retrySection(PREFERENSI_KEYS)}>
            <FieldRow
              def={{
                key: "default_min_stock",
                label: "Stok Minimum Default",
                icon: Tag,
                placeholder: "5",
                type: "number",
                hint: "Ambang stok menipis untuk barang baru. Bisa diubah per barang di halaman Barang.",
              }}
              value={settings.default_min_stock ?? ""}
              status={saveState.default_min_stock}
              onChange={handleChange}
              onBlur={handleBlur}
              onReset={() => resetField("default_min_stock")}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <p className="pt-1 text-center text-xs text-ink-faint">{APP_VERSION}</p>
    </div>
  )
}
