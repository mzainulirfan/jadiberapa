"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getStoreByCode } from "@/lib/db/queries"

type Mode = "owner" | "kasir"

export function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>("owner")
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
  const [storeName, setStoreName] = useState("")
  const [storeCode, setStoreCode] = useState("")
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

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <div>
          <Input
            placeholder="Nama Toko"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            autoComplete="organization"
          />
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
      <div>
        <Input
          type="password"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="new-password"
          minLength={4}
          required
        />
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
