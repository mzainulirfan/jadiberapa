"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getStoreMembers, inviteKasir, removeMember, type BxStaffMember } from "@/lib/db/queries"
import { useRole } from "@/lib/hooks/use-role"
import { resetMemberPasscode } from "@/lib/actions/auth"
import { Plus, Trash, User, KeyRound } from "@/components/ui/icons"

function AddKasirForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const u = username.trim()
    if (!u) return
    setPending(true)
    setError(null)
    const res = await inviteKasir(u)
    setPending(false)
    if (res) {
      setError(res)
      return
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="kasir-username" className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <User className="size-3.5" /> Username Kasir
        </label>
        <Input
          id="kasir-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="mis. andi"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          required
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          Akun kasir harus sudah didaftarkan lebih dulu di halaman daftar.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Tambah Kasir"}
      </Button>
    </form>
  )
}

export function StaffView() {
  const role = useRole()
  const router = useRouter()
  const [members, setMembers] = useState<BxStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<BxStaffMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [resetTarget, setResetTarget] = useState<BxStaffMember | null>(null)
  const [resetPasscode, setResetPasscode] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { members: list } = await getStoreMembers()
      if (active) {
        setMembers(list)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (role === "kasir" || role === null) router.replace("/dashboard")
  }, [role, router])

  async function load() {
    const { members: list } = await getStoreMembers()
    setMembers(list)
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    const err = await removeMember(removeTarget.user_id)
    setRemoving(false)
    if (err) {
      toast.error(err)
      return
    }
    setRemoveTarget(null)
    toast.success("Kasir dihapus dari toko")
    load()
  }

  async function handleReset() {
    if (!resetTarget) return
    if (resetPasscode.length < 4 || resetPasscode.length > 6) {
      setResetError("Passcode harus 4-6 digit angka.")
      return
    }
    setResetting(true)
    setResetError(null)
    const { error } = await resetMemberPasscode(resetTarget.user_id, resetPasscode)
    setResetting(false)
    if (error) {
      setResetError(error)
      return
    }
    setResetTarget(null)
    setResetPasscode("")
    toast.success(`Passcode @${resetTarget.username} direset`)
  }

  if (role !== "owner") return null

  return (
    <div className="space-y-3 p-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground active:bg-primary-active"
        >
          <Plus className="size-4" /> Tambah Kasir
        </DialogTrigger>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tambah Kasir</DialogTitle>
            <DialogDescription>
              Kasir login dengan akunnya sendiri dan otomatis memakai toko ini.
            </DialogDescription>
          </DialogHeader>
          <AddKasirForm
            onDone={() => {
              setOpen(false)
              toast.success("Kasir ditambahkan")
              load()
            }}
          />
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Belum ada kasir</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                {m.username.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">@{m.username}</p>
                <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] text-ink-muted">
                  {m.role === "owner" ? "Pemilik" : "Kasir"}
                </span>
              </div>
              {m.role !== "owner" && (
                <>
                  <button
                    onClick={() => {
                      setResetTarget(m)
                      setResetPasscode("")
                      setResetError(null)
                    }}
                    aria-label={`Reset passcode ${m.username}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
                  >
                    <KeyRound className="size-4" />
                  </button>
                  <button
                    onClick={() => setRemoveTarget(m)}
                    aria-label={`Hapus ${m.username}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
                  >
                    <Trash className="size-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Kasir?</DialogTitle>
            <DialogDescription>
              @{removeTarget?.username} tidak lagi bisa mengakses toko ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetTarget !== null} onOpenChange={(o) => !o && !resetting && setResetTarget(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Reset Passcode Kasir</DialogTitle>
            <DialogDescription>
              Passcode baru untuk @{resetTarget?.username}. Kasir perlu masuk lagi
              dengan passcode baru ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Passcode baru (4-6 digit)"
              value={resetPasscode}
              onChange={(e) => setResetPasscode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              autoFocus
            />
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                Batal
              </Button>
              <Button
                onClick={handleReset}
                disabled={resetting || resetPasscode.length < 4}
              >
                {resetting ? "Menyimpan..." : "Reset Passcode"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
