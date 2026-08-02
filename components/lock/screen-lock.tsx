"use client"

import { createContext, useContext, useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock } from "@/components/ui/icons"

// Kunci layar cepat untuk perangkat bersama di kasir. Status kunci disimpan di
// sessionStorage: bertahan saat berpindah halaman/refresh dalam tab yang sama,
// hilang saat tab ditutup (bukan "keluar akun" permanen).
const STORAGE_KEY = "saberaha-locked"

function isLockedStored() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

type LockContextValue = {
  locked: boolean
  lock: () => void
  unlock: (passcode: string) => Promise<string | null>
}

const LockContext = createContext<LockContextValue | null>(null)

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { verifyPasscode } = useAuth()
  const [locked, setLocked] = useState(isLockedStored)

  function lock() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // sessionStorage tak tersedia: kunci hanya berlaku sesi komponen ini.
    }
    setLocked(true)
  }

  async function unlock(passcode: string) {
    const err = await verifyPasscode(passcode)
    if (err) return err
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // abaikan
    }
    setLocked(false)
    return null
  }

  return (
    <LockContext value={{ locked, lock, unlock }}>
      {children}
      {locked && <LockScreen onUnlock={unlock} />}
    </LockContext>
  )
}

function LockScreen({ onUnlock }: { onUnlock: (p: string) => Promise<string | null> }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (checking || value.length < 4) return
    setChecking(true)
    setError(null)
    const err = await onUnlock(value)
    setChecking(false)
    if (err) {
      setError(err)
      setValue("")
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-canvas px-6">
      <span className="flex size-14 items-center justify-center rounded-full bg-ink text-white">
        <Lock className="size-6" />
      </span>
      <div className="text-center">
        <p className="text-base font-bold text-ink">Layar Terkunci</p>
        <p className="mt-0.5 text-xs text-ink-faint">Masukkan passcode untuk melanjutkan</p>
      </div>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="Passcode 4-6 digit"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          className="text-center text-lg font-semibold tracking-widest"
          autoFocus
          maxLength={6}
        />
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={checking || value.length < 4}
        >
          {checking ? "Memeriksa..." : "Buka Kunci"}
        </Button>
      </form>
    </div>
  )
}

export function useLock() {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error("useLock must be used within LockProvider")
  return ctx
}
