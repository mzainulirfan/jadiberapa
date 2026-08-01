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
            : { store_name: storeName.trim() || "Toko Saya", store_template: templateKey },
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

    if (mode === "owner") {
      window.localStorage.setItem(PENDING_STORE_TEMPLATE_KEY, templateKey)
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {invited && (
        <div className="rounded-xl border border-hairline bg-canvas p-3 text-sm text-ink-muted">
          Anda diundang bergabung sebagai <span className="font-semibold text-ink">kasir</span>. Kode
          toko sudah terisi — lengkapi akun Anda di bawah.
        </div>
      )}

      <div className="flex rounded-full bg-canvas-soft p-1">
        <button
          type="button"
          onClick={() => {
            setMode("owner")
            setFoundStore(null)
          }}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "owner" ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
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
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "kasir" ? "bg-canvas text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Daftar sebagai Kasir
        </button>
      </div>

      {mode === "owner" ? (
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Nama Toko"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-ink">Template toko</p>
              <p className="text-xs text-ink-faint">Pilih data awal. Semua bisa diedit setelah daftar.</p>
            </div>
            <TemplatePicker value={templateKey} onChange={setTemplateKey} compact />
          </div>
        </div>
      ) : (
        <div>
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

      <div>
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
        <p className="text-destructive text-sm text-center">{error}</p>
      )}
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? "Mendaftar..." : "Daftar"}
      </Button>
    </form>
  )
}
