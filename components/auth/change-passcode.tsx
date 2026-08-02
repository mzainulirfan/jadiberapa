"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changePasscode } from "@/lib/actions/auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const digits = (s: string) => s.replace(/\D/g, "")

export function ChangePasscodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      setError("Konfirmasi passcode tidak cocok.")
      return
    }
    setPending(true)
    setError(null)
    const res = await changePasscode(current, next)
    setPending(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setCurrent("")
    setNext("")
    setConfirm("")
    onOpenChange(false)
    toast.success("Passcode diganti")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onOpenChange(v)}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>Ganti Passcode</DialogTitle>
          <DialogDescription>
            Passcode dipakai saat masuk aplikasi. Harus 6 digit angka.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Passcode saat ini"
            value={current}
            onChange={(e) => setCurrent(digits(e.target.value))}
            maxLength={6}
            autoFocus
          />
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Passcode baru (6 digit)"
            value={next}
            onChange={(e) => setNext(digits(e.target.value))}
            maxLength={6}
            minLength={6}
          />
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Ulangi passcode baru"
            value={confirm}
            onChange={(e) => setConfirm(digits(e.target.value))}
            maxLength={6}
            minLength={6}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={pending || !current || next.length < 6 || confirm.length < 6}
          >
            {pending ? "Menyimpan..." : "Simpan Passcode"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
