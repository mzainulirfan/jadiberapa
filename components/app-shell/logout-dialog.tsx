"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/hooks/use-auth"

// Dialog keluar akun yang dipakai bersama Sidebar dan DesktopHeader.
export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loggingOut && onOpenChange(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Keluar dari akun?</DialogTitle>
          <DialogDescription>
            Anda perlu masuk kembali untuk menggunakan aplikasi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loggingOut}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Keluar..." : "Keluar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}