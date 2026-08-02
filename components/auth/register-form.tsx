"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, Eye, EyeOff, Package, Tag } from "@/components/ui/icons"
import { getStoreByCode } from "@/lib/db/queries"
import { TemplatePicker } from "@/components/templates/template-picker"
import { getStoreTemplate } from "@/lib/templates"
import { storeTemplateOptions } from "@/lib/templates/options"
import { translateAuthError } from "@/lib/auth/auth-errors"

type Mode = "owner" | "kasir"

export function RegisterForm({
  mode,
  initialCode,
}: {
  mode: Mode
  initialCode?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const isOwner = mode === "owner"
  const invited = !isOwner && Boolean(initialCode?.trim())
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [storeName, setStoreName] = useState("")
  const [storeCode, setStoreCode] = useState(initialCode ?? "")
  const [templateKey, setTemplateKey] = useState("kelontong")
  const [foundStore, setFoundStore] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const passcodeRef = useRef<HTMLInputElement>(null)

  const selectedTemplate = getStoreTemplate(templateKey)
  const selectedOption = storeTemplateOptions.find((option) => option.key === templateKey)

  useEffect(() => {
    if (isOwner) return
    const code = storeCode.trim()
    if (!code) return

    let active = true
    const timer = setTimeout(async () => {
      const store = await getStoreByCode(code)
      if (active) setFoundStore(store?.name ?? null)
    }, 400)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isOwner, storeCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanUsername = username.trim().toLowerCase()
    if (cleanUsername.includes("@")) {
      setError("Username tidak boleh mengandung @")
      return
    }
    if (isOwner && !storeName.trim()) {
      setError("Masukkan nama toko")
      return
    }

    if (!isOwner) {
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
    const { error: signUpError } = await supabase.auth.signUp({
      email: `${cleanUsername}@app.pos`,
      password: passcode,
      options: {
        data: isOwner
          ? { store_name: storeName.trim(), template_key: templateKey }
          : { store_code: storeCode.trim() },
      },
    })
    setLoading(false)

    if (signUpError) {
      setError(translateAuthError(signUpError.message))
      setPasscode("")
      passcodeRef.current?.focus()
      return
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.625px] text-ink">
          {isOwner ? "Buat toko baru" : "Gabung sebagai kasir"}
        </h1>
        <p className="text-sm text-ink-muted">
          {isOwner
            ? "Siapkan toko dan akun pemilik dalam satu langkah."
            : "Masukkan kode toko dari pemilik untuk bergabung."}
        </p>
      </div>

      {invited && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-ink-muted">
          Kode undangan sudah terisi. Akun akan bergabung sebagai kasir.
        </div>
      )}

      {isOwner ? (
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
              autoFocus
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

            <div key={templateKey} className="rounded-xl border border-hairline bg-canvas-soft p-3 duration-200 animate-in fade-in">
              <p className="text-sm font-semibold text-ink">{selectedOption?.name ?? "Isi awal toko"}</p>
              {selectedTemplate ? (
                <>
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
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                    {selectedTemplate.categories.slice(0, 4).map((category) => (
                      <li key={category} className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <Check className="size-3 shrink-0 text-primary" />
                        <span className="truncate">{category}</span>
                      </li>
                    ))}
                  </ul>
                  {selectedTemplate.categories.length > 4 && (
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      +{selectedTemplate.categories.length - 4} kategori lainnya
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-ink-faint">Semua data bisa diubah setelah toko dibuat.</p>
                </>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">
                  Tanpa kategori dan produk contoh. Data dapat ditambahkan setelah toko dibuat.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="store-code" className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Kode toko
          </label>
          <Input
            id="store-code"
            placeholder="Contoh: warung-1234"
            value={storeCode}
            onChange={(e) => {
              setStoreCode(e.target.value)
              setFoundStore(null)
            }}
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus={!invited}
            className="font-mono"
            required
          />
          <p className="text-xs text-ink-faint">
            {foundStore ? `Akan bergabung ke toko "${foundStore}".` : "Minta kode toko kepada pemilik."}
          </p>
        </div>
      )}

      <div className="space-y-3 border-t border-hairline pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {isOwner ? "Akun pemilik" : "Informasi akun"}
        </p>
        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
          >
            Username
          </label>
          <Input
            id="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="passcode"
            className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
          >
            Passcode
          </label>
          <div className="relative">
            <Input
              id="passcode"
              type={showPass ? "text" : "password"}
              placeholder="6 digit"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="new-password"
              inputMode="numeric"
              minLength={6}
              maxLength={6}
              required
              className="pr-10"
              ref={passcodeRef}
            />
            <button
              type="button"
              onClick={() => setShowPass((value) => !value)}
              aria-label={showPass ? "Sembunyikan passcode" : "Tampilkan passcode"}
              className="absolute inset-y-0 right-1 flex w-9 items-center justify-center text-ink-muted active:text-ink"
            >
              {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading
          ? isOwner
            ? "Membuat toko..."
            : "Bergabung..."
          : isOwner
            ? "Buat Toko & Akun"
            : "Gabung ke Toko"}
      </Button>

      {isOwner ? (
        <div className="border-t border-hairline pt-4 text-center">
          <p className="text-sm text-ink-muted">Sudah punya toko?</p>
          <Link
            href="/register?mode=kasir"
            className="mt-1 inline-block text-sm font-semibold text-primary"
          >
            Gabung sebagai Kasir →
          </Link>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-muted">
          Ingin membuat toko baru?{" "}
          <Link href="/register" className="font-medium text-primary">
            Buat toko
          </Link>
        </p>
      )}
    </form>
  )
}
