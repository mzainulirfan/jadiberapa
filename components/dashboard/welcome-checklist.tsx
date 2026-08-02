"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, Package, Tag, User, X } from "@/components/ui/icons"
import {
  getDiscounts,
  getLoyaltyConfig,
  getProducts,
  getStoreMembers,
} from "@/lib/db/queries"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "welcome-checklist-dismissed"

type ChecklistItem = {
  key: string
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  done: boolean
}

// Checklist "langkah pertama" untuk pemilik toko baru: hilang otomatis saat
// semua selesai, atau bisa dilewati (tersimpan di localStorage).
export function WelcomeChecklist({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && !!window.localStorage.getItem(DISMISS_KEY)
  )
  const [items, setItems] = useState<ChecklistItem[] | null>(null)

  useEffect(() => {
    if (!enabled || dismissed) return
    let active = true
    async function load() {
      const [products, members, discounts, loyalty] = await Promise.all([
        getProducts({ withCount: true, limit: 1 }),
        getStoreMembers(),
        getDiscounts(),
        getLoyaltyConfig(),
      ])
      if (!active) return
      setItems([
        {
          key: "products",
          title: "Tambah barang pertama",
          description: "Buka halaman Barang lalu isi produk jualan Anda.",
          href: "/products",
          icon: Package,
          done: (products.total ?? 0) > 0,
        },
        {
          key: "staff",
          title: "Undang kasir",
          description: "Bagikan kode toko agar kasir bisa bergabung.",
          href: "/staff",
          icon: User,
          done: (members.members?.length ?? 0) > 1,
        },
        {
          key: "promo",
          title: "Siapkan diskon & poin",
          description: "Buat promo atau aktifkan poin loyalitas untuk pembeli.",
          href: "/discounts",
          icon: Tag,
          done: (discounts?.length ?? 0) > 0 || loyalty.enabled,
        },
      ])
    }
    load()
    return () => {
      active = false
    }
  }, [enabled, dismissed])

  if (!enabled || dismissed || !items) return null
  const pending = items.filter((item) => !item.done)
  if (pending.length === 0) return null
  const doneCount = items.length - pending.length

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-ink">Langkah pertama</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Selesaikan agar toko siap dipakai. {doneCount} dari {items.length} selesai.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Lewati daftar langkah"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors active:bg-canvas-soft active:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl p-2.5 transition-colors active:bg-canvas-soft",
                item.done && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  item.done
                    ? "border-accent-green/30 bg-accent-green/10 text-accent-green"
                    : "border-hairline bg-canvas-soft text-ink-muted"
                )}
              >
                {item.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium text-ink",
                    item.done && "line-through"
                  )}
                >
                  {item.title}
                </span>
                <span className="block truncate text-xs text-ink-muted">{item.description}</span>
              </span>
              {!item.done && <ChevronRight className="size-4 shrink-0 text-ink-faint" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
