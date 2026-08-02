"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { translateAuthError } from "@/lib/auth/auth-errors"

type AuthContext = {
  user: User | null
  loading: boolean
  login: (username: string, passcode: string) => Promise<string | null>
  logout: () => Promise<void>
  verifyPasscode: (passcode: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual"
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  async function login(username: string, passcode: string): Promise<string | null> {
    const email = `${username}@app.pos`
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: passcode,
    })
    if (error) return translateAuthError(error.message)
    router.push("/dashboard")
    return null
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Verifikasi passcode tanpa memindahkan halaman (dipakai membuka kunci layar).
  // Kembali null bila cocok, atau pesan error bila salah.
  async function verifyPasscode(passcode: string): Promise<string | null> {
    if (!user?.email) return "Sesi tidak ditemukan"
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passcode,
    })
    return error ? translateAuthError(error.message) : null
  }

  return (
    <AuthContext value={{ user, loading, login, logout, verifyPasscode }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
