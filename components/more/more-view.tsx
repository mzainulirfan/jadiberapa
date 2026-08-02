"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
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
import {
  getStoreProfile,
  getMyStores,
  setActiveStore,
  invalidateAllDataCaches,
  type BxStoreProfile,
  type BxStore,
} from "@/lib/db/queries"
import { useAuth } from "@/lib/hooks/use-auth"
import { useRole } from "@/lib/hooks/use-role"
import {
  User as UserIcon,
  BarChart,
  Tag,
  Cog,
  ChevronRight,
  LogOut,
  Wallet,
  Dollar,
  Zap,
  Receipt,
  ShoppingBag,
  Store,
  Check,
  ChartLine,
  Copy,
  Package,
} from "@/components/ui/icons"

const APP_VERSION = "Saberaha v1.0.0"

type Item = { href: string; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }
type Group = { title: string; items: Item[] }

// Menu khusus pemilik toko: pengelolaan bisnis + pengaturan aplikasi.
const OWNER_GROUPS: Group[] = [
  {
    title: "Operasional",
    items: [
      { href: "/shift", label: "Shift Kasir", desc: "Buka/tutup laci & selisih kas", icon: Receipt },
      { href: "/expenses", label: "Pengeluaran", desc: "Biaya operasional & laba bersih", icon: Dollar },
      { href: "/reports", label: "Laporan", desc: "Laporan penjualan", icon: BarChart },
    ],
  },
  {
    title: "Stok & Beli",
    items: [
      { href: "/suppliers", label: "Supplier", desc: "Daftar & kelola pemasok", icon: Package },
      { href: "/purchases", label: "Pembelian", desc: "Nota beli & utang supplier", icon: Receipt },
    ],
  },
  {
    title: "Pelanggan",
    items: [
      { href: "/customers", label: "Pembeli", desc: "Daftar & kelola pembeli", icon: ShoppingBag },
      { href: "/debts", label: "Utang", desc: "Kasbon & pelunasan pembeli", icon: Wallet },
    ],
  },
  {
    title: "Barang & Promo",
    items: [
      { href: "/categories", label: "Kategori", desc: "Kelola kategori barang", icon: Tag },
      { href: "/discounts", label: "Diskon", desc: "Kelola promo & harga diskon", icon: Zap },
    ],
  },
  {
    title: "Tim",
    items: [
      { href: "/staff", label: "Kelola Kasir", desc: "Tambah/hapus kasir toko", icon: UserIcon },
    ],
  },
    {
      title: "Aplikasi",
      items: [
        { href: "/settings", label: "Pengaturan", desc: "Info toko & pembayaran", icon: Cog },
        { href: "/backup", label: "Cadangan Data", desc: "Export / pulihkan data toko", icon: ChartLine },
      ],
    },
  ]

// Menu yang tetap boleh dilihat kasir: operasional kasir sehari-hari.
const KASIR_GROUPS: Group[] = [
  {
    title: "Operasional",
    items: [
      { href: "/shift", label: "Shift Kasir", desc: "Buka/tutup laci & selisih kas", icon: Receipt },
    ],
  },
  {
    title: "Pelanggan",
    items: [
      { href: "/customers", label: "Pembeli", desc: "Daftar & kelola pembeli", icon: ShoppingBag },
      { href: "/debts", label: "Utang", desc: "Kasbon & pelunasan pembeli", icon: Wallet },
    ],
  },
]

export function MoreView() {
  const { user, logout } = useAuth()
  const role = useRole()
  const [profile, setProfile] = useState<BxStoreProfile | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [storeOpen, setStoreOpen] = useState(false)
  const [stores, setStores] = useState<BxStore[]>([])
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getStoreProfile().then((p) => {
      if (active) setProfile(p)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  async function openStores() {
    setStores(await getMyStores())
    setStoreOpen(true)
  }

  async function handleSwitch(id: string) {
    if (switching) return
    setSwitching(id)
    const err = await setActiveStore(id)
    setSwitching(null)
    if (err) {
      toast.error(err)
      return
    }
    invalidateAllDataCaches()
    toast.success("Toko diganti")
    // Reload penuh: reset seluruh state & cache yang terikat toko aktif.
    window.location.reload()
  }

  async function copyStoreCode() {
    if (!profile?.store_code) return
    try {
      await navigator.clipboard.writeText(profile.store_code)
      toast.success("Kode toko disalin")
    } catch {
      toast.error("Gagal menyalin kode toko")
    }
  }

  const isOwner = role === "owner"
  const groups = role ? (isOwner ? OWNER_GROUPS : KASIR_GROUPS) : []

  const storeName = profile?.store_name?.trim() || "Toko Saya"
  const username = user?.email?.split("@")[0]
  const phone = profile?.store_phone?.trim()
  const subtitle = [phone, username && `@${username}`].filter(Boolean).join(" · ") || "Akun kasir"

  const profileCard = profile === null ? (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-4">
      <Skeleton className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="mt-1.5 h-3 w-40 rounded-full" />
      </div>
      <Skeleton className="size-4 shrink-0 rounded-sm" />
    </div>
  ) : isOwner ? (
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
        {profile?.store_code && (
          <p className="mt-1 text-[11px] font-mono text-ink-faint">Kode: {profile.store_code}</p>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-faint" />
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-lg font-bold text-white">
        {storeName.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">{storeName}</p>
        <p className="truncate text-xs text-ink-muted">{subtitle}</p>
        {profile?.store_code && (
          <p className="mt-1 text-[11px] font-mono text-ink-faint">Kode: {profile.store_code}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-5 p-4">
      {profileCard}

      {profile?.store_code && (
        <button
          type="button"
          onClick={copyStoreCode}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-canvas p-3 text-sm font-medium text-ink transition-colors active:bg-canvas-soft"
        >
          <Copy className="size-4 text-ink-muted" />
          Salin kode toko aktif
        </button>
      )}

      {role === undefined || !groups.length ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3.5">
              <Skeleton className="size-5 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-semibold tracking-wide text-ink-faint uppercase">Toko</p>
            <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
              <button
                type="button"
                onClick={openStores}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors active:bg-canvas-soft"
              >
                <Store className="size-5 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Toko Aktif</p>
                  <p className="truncate text-xs text-ink-faint">{storeName}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
              </button>
            </div>
          </div>

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
              </div>
            </div>
          ))}

          <div className="divide-y divide-hairline rounded-xl border border-hairline bg-canvas">
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
          </div>
        </>
      )}

      <p className="pt-1 text-center text-xs text-ink-faint">{APP_VERSION}</p>

      <Dialog open={storeOpen} onOpenChange={(o) => !switching && setStoreOpen(o)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Pilih Toko</DialogTitle>
            <DialogDescription>Pindah ke toko lain yang Anda ikuti.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {stores.map((s) => (
              <button
                key={s.store_id}
                type="button"
                onClick={() => handleSwitch(s.store_id)}
                disabled={switching !== null}
                className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-canvas p-3 text-left transition-colors active:bg-canvas-soft disabled:opacity-60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] text-ink-muted">
                    {s.role === "owner" ? "Pemilik" : "Kasir"}
                  </span>
                </div>
                {s.active && <Check className="size-5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStoreOpen(false)} disabled={switching !== null}>
              {switching ? "Mengganti..." : "Tutup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
