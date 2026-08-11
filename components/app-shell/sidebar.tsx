"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/components/cart/cart-provider"
import { useAuth } from "@/lib/hooks/use-auth"
import { useRole } from "@/lib/hooks/use-role"
import { useLock } from "@/components/lock/screen-lock"
import { useCashierMode } from "@/components/auth/cashier-mode"
import { getStoreProfile } from "@/lib/db/queries"
import { Skeleton } from "@/components/ui/skeleton"
import {
  NAV_GROUPS,
  routesForRole,
  type AppRoute,
  type NavRole,
} from "@/lib/navigation"
import { ChevronRight, Lock, LogOut } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { LogoutDialog } from "./logout-dialog"

function roleLabel(role: NavRole): string {
  return role === "owner" ? "Pemilik" : "Kasir"
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const role = useRole()
  const { status } = useCashierMode()
  const { user } = useAuth()
  const { lock } = useLock()
  const { count } = useCart()
  const [profile, setProfile] = useState<{ store_name: string | null } | null | undefined>(
    undefined
  )
  const [logoutOpen, setLogoutOpen] = useState(false)

  useEffect(() => {
    let active = true
    getStoreProfile().then((p) => {
      if (active) {
        setProfile(p ? { store_name: p.store_name } : null)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const delegated = Boolean(status?.active && status.delegation)
  // Role efektif: saat delegated cashier mode, owner melihat navigasi kasir.
  // Role sentinel "delegation_locked" (delegasi expired/invalid) juga fail-close
  // ke navigasi kasir; overlay blocking tetap menutupi layar.
  const loading = role === undefined
  const locked =
    delegated ||
    (role as "owner" | "kasir" | "delegation_locked" | null | undefined) ===
      "delegation_locked"
  const effectiveRole: NavRole = loading || locked ? "kasir" : role ?? "kasir"

  const username = user?.email?.split("@")[0]
  const storeName = profile?.store_name?.trim() || "Toko Saya"

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  if (loading || profile === undefined) return <SidebarSkeleton className={className} />

  const canSwitchStore = role === "owner" && !delegated

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "h-full shrink-0 flex-col overflow-y-auto border-r border-hairline bg-canvas",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
          S
        </span>
        <span className="text-[15px] font-bold tracking-[-0.2px] text-ink">Saberaha</span>
      </div>

      <div className="px-3">
        {canSwitchStore ? (
          <Link
            href="/more"
            className="flex items-center gap-2.5 rounded-xl border border-hairline bg-canvas p-2.5 transition-colors hover:bg-canvas-soft"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              {storeName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{storeName}</p>
              <p className="text-[11px] text-ink-faint">
                {roleLabel(role ?? "kasir")}
                {username && <> · @{username}</>}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </Link>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2.5",
              delegated ? "border-amber-300 bg-amber-100/50" : "border-hairline bg-canvas"
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              {storeName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{storeName}</p>
              <p className="text-[11px] text-ink-faint">
                {delegated ? "Mode kasir aktif" : roleLabel(effectiveRole)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {NAV_GROUPS.map((group) => {
          const routes = routesForRole(group.routes, effectiveRole)
          if (routes.length === 0) return null
          return (
            <div key={group.title} className="pt-2">
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {routes.map((route) => (
                  <NavItem
                    key={route.href}
                    route={route}
                    active={isActive(route.href)}
                    badge={route.cartBadge ? count : 0}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={lock}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
        >
          <Lock className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Kunci Layar</span>
        </button>
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Keluar</span>
        </button>
      </div>

      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </nav>
  )
}

function NavItem({
  route,
  active,
  badge,
}: {
  route: AppRoute
  active: boolean
  badge: number
}) {
  const Icon = route.icon
  return (
    <Link
      href={route.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-canvas-soft text-ink"
          : "text-ink-muted hover:bg-canvas-soft hover:text-ink"
      )}
    >
      {active && (
        <span className="absolute top-1/2 left-0 h-4 w-1 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{route.label}</span>
      {badge > 0 && (
        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  )
}

function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "h-full shrink-0 flex-col gap-2 overflow-hidden border-r border-hairline bg-canvas",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-hairline p-2.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <div className="px-3 pt-3">
        <Skeleton className="mb-1 h-3 w-12 rounded-full" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-3.5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}