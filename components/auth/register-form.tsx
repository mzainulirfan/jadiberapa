"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
  const [storeName, setStoreName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (username.includes("@")) {
      setError("Username tidak boleh mengandung @")
      return
    }

    setLoading(true)

    const email = `${username}@app.pos`
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: passcode,
      options: {
        data: { store_name: storeName.trim() || "Toko Saya" },
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
      <div>
        <Input
          placeholder="Nama Toko"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          autoComplete="organization"
        />
      </div>
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
