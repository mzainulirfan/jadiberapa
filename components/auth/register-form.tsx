"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "@/components/ui/icons"
import { getStoreByCode } from "@/lib/db/queries"
import { TemplatePicker } from "@/components/templates/template-picker"
import { PENDING_STORE_TEMPLATE_KEY } from "@/lib/templates/options"

type Mode = "owner" | "kasir"

export function RegisterForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const invited = Boolean(initialCode?.trim())
  const [mode, setMode] = useState<Mode>(invited ? "kasir" : "owner")
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [storeName, setStoreName] = useState("")
  const [storeCode, setStoreCode] = useState(initialCode ?? "")
  const [templateKey, setTemplateKey] = useState("kelontong")
  const [foundStore, setFoundStore] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isOwner = mode === "owner"
  const headerTitle = isOwner ? "Buat toko baru" : "Gabung sebagai kasir"
  const headerDesc = isOwner
    ? "Pilih template awal, lalu sesuaikan kategori dan barang sesuai toko Anda."
    : "Lengkapi akun untuk bergabung ke toko yang mengundang Anda."

  // Cek kode toko (dengan jeda singkat) untuk menampilkan nama toko tujuan.
  useEffect(() => {
    if (mode !== "kasir") return
    const code = storeCode.trim()
    if (!code) return
    let active = true
    const t = setTimeout(async () => {
      const store = await getStoreByCode(code)
      if (active) setFoundStore(store?.name ?? null)
    }, 400)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [mode, storeCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (username.includes("@")) {
      setError("Username tidak boleh mengandung @")
      return
    }

    if (mode === "kasir") {
      const code = storeCode.trim()
      if (!code) {
        setError("Masukkan kode toko")
        return
      }
      const store = await getStoreByCode(code)
      if (!store) {
        setError("Kode toko tidak ditemukan")
        return
      }
    }

    setLoading(true)

    const email = `${username}@app.pos`
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: passcode,
      options: {
        data:
          mode === "kasir"
            ? { store_code: storeCode.trim() }
            : { store_name: storeName.trim() || "Toko Saya" },
      },
    })

    setLoading(false)
    if (signUpError) {
      if (signUpError.message.includes("already")) {
        setError("Username sudah terdaftar")
      } else {
        setError(signUpError.message)
      }
      return
    }

    if (isOwner) {
      window.localStorage.setItem(PENDING_STORE_TEMPLATE_KEY, templateKey)
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {invited && (
        <div className="rounded-2xl border border-hairline bg-canvas p-3.5 text-sm text-ink-muted shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Undangan kasir</p>
          <p className="mt-1">
            Kode toko sudah terisi. Anda akan bergabung sebagai <span className="font-semibold text-ink">kasir</span>.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.125px] text-ink-faint">
          Mobile POS UMKM
        </p>
        <div className="space-y-1">
          <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.625px] text-ink">
            {headerTitle}
          </h1>
          <p className="text-sm text-ink-muted">{headerDesc}</p>
        </div>
      </div>

      <div className="flex rounded-2xl bg-canvas-soft p-1">
        <button
          type="button"
          onClick={() => {
            setMode("owner")
            setFoundStore(null)
          }}
          className={`flex-1 rounded-[14px] px-3 py-1.5 text-sm font-semibold transition-colors ${
            isOwner ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Buat Toko Baru
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("kasir")
            setFoundStore(null)
          }}
          className={`flex-1 rounded-[14px] px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "kasir" ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Daftar sebagai Kasir
        </button>
      </div>

      {isOwner ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Detail toko</p>
            <Input
              placeholder="Nama Toko"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Template awal</p>
              <p className="text-xs text-ink-faint">Pilih data awal. Semua bisa diedit setelah daftar.</p>
            </div>
            <TemplatePicker value={templateKey} onChange={setTemplateKey} compact />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Kode toko</p>
          <Input
            placeholder="Kode Toko"
            value={storeCode}
            onChange={(e) => {
              setStoreCode(e.target.value)
              if (!e.target.value.trim()) setFoundStore(null)
            }}
            autoCapitalize="none"
            autoCorrect="off"
            className="font-mono"
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            {foundStore === null
              ? "Minta kode toko ke pemilik untuk bergabung."
              : `Akan bergabung ke toko "${foundStore}".`}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Akun</p>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div className="relative">
        <Input
          type={showPass ? "text" : "password"}
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="new-password"
          minLength={4}
          required
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          aria-label={showPass ? "Sembunyikan passcode" : "Tampilkan passcode"}
          className="absolute inset-y-0 right-1 flex w-9 items-center justify-center text-ink-muted active:text-ink"
        >
          {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? (isOwner ? "Membuat akun..." : "Bergabung...") : isOwner ? "Buat Toko" : "Gabung Toko"}
      </Button>
    </form>
  )
}
