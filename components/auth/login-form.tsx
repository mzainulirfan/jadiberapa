"use client"

import { useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "@/components/ui/icons"

export function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (username.includes("@")) {
      setError("Gunakan username, bukan email")
      return
    }

    setLoading(true)
    const err = await login(username, passcode)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Passcode</p>
        <div className="relative">
        <Input
          type={showPass ? "text" : "password"}
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="current-password"
          maxLength={6}
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
      </div>
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? "Masuk..." : "Masuk ke Kasir"}
      </Button>
    </form>
  )
}
