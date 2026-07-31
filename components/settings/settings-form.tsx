"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { updateSetting } from "@/lib/actions/settings"
import { getSettings, invalidateSettings, invalidateStoreProfile } from "@/lib/db/queries"
import { Store, LocationPin, Phone, Qr, Wallet } from "@/components/ui/icons"

type FieldDef = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  placeholder: string
  multiline?: boolean
  inputMode?: "tel" | "text"
  hint?: string
}

const STORE_FIELDS: FieldDef[] = [
  { key: "store_name", label: "Nama Toko", icon: Store, placeholder: "Toko Saya" },
  { key: "store_address", label: "Alamat", icon: LocationPin, placeholder: "Jl. ...", multiline: true },
  { key: "store_phone", label: "Telepon", icon: Phone, placeholder: "08xxx", inputMode: "tel" },
]

export function SettingsForm() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const savedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    let active = true
    getSettings().then((s) => {
      if (!active) return
      setSettings(s)
      savedRef.current = s
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleSave(key: string, raw: string) {
    const value = raw.trim()
    if (value === (savedRef.current[key] ?? "")) return
    const res = await updateSetting(key, value)
    if (res?.error) {
      toast.error("Gagal menyimpan perubahan")
      return
    }
    savedRef.current = { ...savedRef.current, [key]: value }
    setSettings((prev) => ({ ...prev, [key]: value }))
    // Segarkan cache settings (& profil toko) agar pembacaan berikutnya tidak basi.
    invalidateSettings()
    if (key === "store_name" || key === "store_phone") invalidateStoreProfile()
    toast.success("Perubahan tersimpan")
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const qris = settings.qris_payload ?? ""

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-1.5">
        <p className="px-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Informasi Toko
        </p>
        <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
          {STORE_FIELDS.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.key} className="p-3.5">
                <label
                  htmlFor={f.key}
                  className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted"
                >
                  <Icon className="size-3.5" /> {f.label}
                </label>
                {f.multiline ? (
                  <Textarea
                    id={f.key}
                    defaultValue={settings[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onBlur={(e) => handleSave(f.key, e.target.value)}
                    className="min-h-[60px]"
                  />
                ) : (
                  <Input
                    id={f.key}
                    defaultValue={settings[f.key] ?? ""}
                    placeholder={f.placeholder}
                    inputMode={f.inputMode}
                    onBlur={(e) => handleSave(f.key, e.target.value)}
                  />
                )}
                {f.hint && <p className="mt-1.5 text-[11px] text-ink-faint">{f.hint}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="px-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Pembayaran
        </p>
        <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
          <div className="p-3.5">
            <label
              htmlFor="qris_payload"
              className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted"
            >
              <Qr className="size-3.5" /> Kode QRIS
            </label>
            <Textarea
              id="qris_payload"
              value={qris}
              placeholder="00020101021126..."
              onChange={(e) => setSettings((prev) => ({ ...prev, qris_payload: e.target.value }))}
              onBlur={(e) => handleSave("qris_payload", e.target.value)}
              className="min-h-[70px] font-mono text-xs"
            />
            {qris.trim() ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-canvas-soft p-3">
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={qris} size={128} marginSize={0} />
                </div>
                <p className="text-[11px] text-ink-faint">Pratinjau — pastikan QR bisa dipindai</p>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Tempel kode QRIS statis (EMV) dari aplikasi bank / e-wallet Anda.
              </p>
            )}
          </div>

          <div className="p-3.5">
            <label
              htmlFor="dana_number"
              className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted"
            >
              <Wallet className="size-3.5" /> Nomor DANA
            </label>
            <Input
              id="dana_number"
              defaultValue={settings.dana_number ?? ""}
              placeholder="08xxx"
              inputMode="tel"
              onBlur={(e) => handleSave("dana_number", e.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Nomor tujuan pembayaran DANA yang ditampilkan saat checkout.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
