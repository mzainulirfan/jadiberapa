"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getSettings } from "@/lib/actions/settings"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  User as UserIcon,
  BarChart,
  Tag,
  Cog,
  ChevronRight,
  LogOut,
} from "@/components/ui/icons"

const APP_VERSION = "Saberaha v1.0.0"

const groups: {
  title: string
  items: { href: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[]
}[] = [
  {
    title: "Bisnis",
    items: [
      { href: "/customers", label: "Pembeli", desc: "Daftar & kelola pembeli", icon: UserIcon },
      { href: "/categories", label: "Kategori", desc: "Kelola kategori barang", icon: Tag },
      { href: "/reports", label: "Laporan", desc: "Laporan penjualan", icon: BarChart },
    ],
  },
  {
    title: "Aplikasi",
    items: [
      { href: "/settings", label: "Pengaturan", desc: "Info toko & pembayaran", icon: Cog },
    ],
  },
]

export function MoreView() {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    getSettings().then((s) => {
      if (active) setSettings(s)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  const storeName = settings?.store_name?.trim() || "Toko Saya"
  const username = user?.email?.split("@")[0]
  const phone = settings?.store_phone?.trim()
  const subtitle = [phone, username && `@${username}`].filter(Boolean).join(" · ") || "Akun kasir"

  return (
    <div className="space-y-5 p-4">
      {settings === null ? (
        <Skeleton className="h-[76px] rounded-xl" />
      ) : (
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-4 transition-colors active:bg-canvas-soft"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-lg font-bold text-white">
            {storeName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{storeName}</p>
            <p className="truncate text-xs text-ink-muted">{subtitle}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-faint" />
        </Link>
      )}

      {groups.map((g) => (
        <div key={g.title} className="space-y-1.5">
          <p className="px-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            {g.title}
          </p>
          <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
            {g.items.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 p-3.5 transition-colors active:bg-canvas-soft"
                >
                  <Icon className="size-5 shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{item.label}</p>
                    <p className="text-xs text-ink-faint">{item.desc}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                </Link>
              )
            })}
            {g.title === "Aplikasi" && (
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors active:bg-canvas-soft"
              >
                <LogOut className="size-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-destructive">Keluar</p>
                  <p className="text-xs text-ink-faint">Keluar dari akun ini</p>
                </div>
              </button>
            )}
          </div>
        </div>
      ))}

      <p className="pt-1 text-center text-xs text-ink-faint">{APP_VERSION}</p>

      <Dialog open={confirmLogout} onOpenChange={(o) => !o && !loggingOut && setConfirmLogout(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Keluar dari akun?</DialogTitle>
            <DialogDescription>
              Anda perlu masuk kembali untuk menggunakan aplikasi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)} disabled={loggingOut}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Keluar..." : "Keluar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
