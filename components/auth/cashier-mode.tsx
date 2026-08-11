"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { endCashierDelegation } from "@/lib/actions/delegation"
import { useCart } from "@/components/cart/cart-provider"
import {
  getCashierDelegationStatus,
  type CashierDelegationStatus,
} from "@/lib/db/delegation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, LogOut, User } from "@/components/ui/icons"

type CashierModeContextValue = {
  status: CashierDelegationStatus | undefined
  refresh: () => void
}

const CashierModeContext = React.createContext<CashierModeContextValue | null>(null)

export function CashierModeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<CashierDelegationStatus>()
  const [refreshKey, setRefreshKey] = React.useState(0)
  const latestRequestRef = React.useRef(0)
  const cacheLoadedRef = React.useRef(false)

  React.useEffect(() => {
    let active = true

    async function load() {
      const requestId = ++latestRequestRef.current
      const cached = cacheLoadedRef.current
        ? null
        : window.sessionStorage.getItem("saberaha-cashier-mode")
      cacheLoadedRef.current = true
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CashierDelegationStatus
          if (active && requestId === latestRequestRef.current) setStatus(parsed)
        } catch {
          window.sessionStorage.removeItem("saberaha-cashier-mode")
        }
      }
      try {
        const next = await getCashierDelegationStatus()
        if (active && requestId === latestRequestRef.current) {
          setStatus(next)
          window.sessionStorage.setItem("saberaha-cashier-mode", JSON.stringify(next))
        }
      } catch {
        // Existing RLS still protects all writes if the indicator cannot load.
      }
    }

    load()
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      active = false
      latestRequestRef.current += 1
      window.removeEventListener("focus", onFocus)
    }
  }, [refreshKey])

  React.useEffect(() => {
    if (!status?.active || !status.delegation) return
    const delay = Date.parse(status.delegation.expires_at) - Date.now()
    const timer = window.setTimeout(
      () => setStatus({ ...status, active: false, status: "expired" }),
      Math.max(0, delay)
    )
    return () => window.clearTimeout(timer)
  }, [status])

  return (
    <CashierModeContext.Provider
      value={{ status, refresh: () => setRefreshKey((value) => value + 1) }}
    >
      {children}
    </CashierModeContext.Provider>
  )
}

export function useCashierMode() {
  const context = React.useContext(CashierModeContext)
  if (!context) throw new Error("useCashierMode must be used inside CashierModeProvider")
  return context
}

function EndModeForm({ locked }: { locked: boolean }) {
  const router = useRouter()
  const { clearCart } = useCart()
  const { refresh } = useCashierMode()
  const [passcode, setPasscode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(passcode)) {
      setError("Passcode owner harus 6 digit angka.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await endCashierDelegation(passcode)
      if (result.error) {
        setError(result.error)
        return
      }
      window.sessionStorage.removeItem("saberaha-cashier-mode")
      clearCart()
      refresh()
      router.replace("/dashboard")
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        placeholder="Passcode owner (6 digit)"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value.replace(/\D/g, ""))}
        maxLength={6}
        autoFocus
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={pending || passcode.length !== 6}>
          <LogOut className="size-4" />
          {pending ? "Memverifikasi..." : locked ? "Kembali ke Mode Owner" : "Keluar Mode Kasir"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CashierModeBanner() {
  const { status } = useCashierMode()
  const [open, setOpen] = React.useState(false)
  const delegation = status?.delegation

  if (!delegation || status?.status === "none") return null

  if (!status.active) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-canvas-soft/95 p-4">
        <div className="w-full max-w-sm rounded-[20px] border border-hairline bg-canvas p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-700">
            <AlertTriangle className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-[-0.3px] text-ink">
            Mode kasir {status.status === "expired" ? "telah berakhir" : "tidak lagi valid"}
          </h2>
          <p className="mb-4 mt-1.5 text-sm leading-relaxed text-ink-muted">
            Akses dikunci untuk mencegah sesi ini kembali ke hak owner tanpa verifikasi.
            Masukkan passcode owner untuk melanjutkan.
          </p>
          <EndModeForm locked />
        </div>
      </div>
    )
  }

  const expires = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(delegation.expires_at))

  return (
    <>
      <div className="flex min-h-9 items-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-amber-950">
        <User className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium">
          Mode kasir: @{delegation.cashier_username} hingga {expires}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-amber-400 px-2.5 py-1 text-xs font-semibold active:bg-amber-200"
        >
          Kembali
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Kembali ke Mode Owner</DialogTitle>
            <DialogDescription>
              Keranjang kasir akan dikosongkan. Masukkan passcode owner untuk membuka kembali akses pemilik.
            </DialogDescription>
          </DialogHeader>
          <EndModeForm locked={false} />
        </DialogContent>
      </Dialog>
    </>
  )
}
