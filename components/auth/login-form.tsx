"use client"

import { useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [passcode, setPasscode] = useState("")
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
          autoComplete="current-password"
          maxLength={6}
          required
        />
      </div>
      {error && (
        <p className="text-destructive text-sm text-center">{error}</p>
      )}
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? "Masuk..." : "Masuk"}
      </Button>
    </form>
  )
}
