"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getSettings, updateSetting } from "@/lib/actions/settings"
import { Store, LocationPin, Phone, InfoCircle, Qr, Wallet } from "@/components/ui/icons"

export function SettingsForm() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); setLoading(false) })
  }, [])

  async function handleSave(key: string, value: string) {
    setSaving(true)
    await updateSetting(key, value)
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaving(false)
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
  }

  const fields = [
    { key: "store_name", label: "Nama Toko", icon: Store, placeholder: "Toko Saya" },
    { key: "store_address", label: "Alamat", icon: LocationPin, placeholder: "Jl. ..." },
    { key: "store_phone", label: "Telepon", icon: Phone, placeholder: "08xxx" },
    { key: "qris_payload", label: "Kode QRIS", icon: Qr, placeholder: "0002010102112..." },
    { key: "dana_number", label: "Nomor DANA", icon: Wallet, placeholder: "08xxx" },
  ]

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">Pengaturan</h1>
      <p className="text-ink-muted text-sm mb-3">Pengaturan toko</p>

      <div className="space-y-3">
        {fields.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.key} className="rounded-xl bg-canvas border border-hairline p-3">
              <label className="flex items-center gap-2 text-xs text-ink-muted mb-1.5">
                <Icon className="size-3.5" /> {f.label}
              </label>
              <div className="flex gap-2">
                <Input
                  defaultValue={settings[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onBlur={(e) => handleSave(f.key, e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-canvas-soft border border-hairline p-4 text-center">
        <InfoCircle className="size-5 text-ink-faint mx-auto mb-1" />
        <p className="text-xs text-ink-muted">Saberaha v1.0.0</p>
        <p className="text-xs text-ink-faint mt-0.5">Aplikasi kasir untuk warung dan UMKM</p>
      </div>
    </div>
  )
}

