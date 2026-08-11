"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/components/cart/cart-provider"
import { useAuth } from "@/lib/hooks/use-auth"
import { useRole } from "@/lib/hooks/use-role"
import { useLock } from "@/components/lock/screen-lock"
import { breadcrumbs, resolveRoute } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShoppingBag, Lock, LogOut, ChevronRight, Cog } from "@/components/ui/icons"
import { LogoutDialog } from "./logout-dialog"
import { cn } from "@/lib/utils"

export function DesktopHeader({ className }: { className?: string }) {
  const pathname = usePathname()
  const { count } = useCart()
  const { user } = useAuth()
  const role = useRole()
  const { lock } = useLock()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const meta = resolveRoute(pathname)
  const crumbs = breadcrumbs(pathname)
  const username = user?.email?.split("@")[0]
  const isOwner = role === "owner"

  return (
    <header
      className={cn(
        "h-16 shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {crumbs.length > 1 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-0.5 flex items-center gap-1 text-xs text-ink-faint"
          >
            {crumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink-muted">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-[22px] leading-tight font-bold tracking-[-0.3px] text-ink">
          {meta.label}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link href="/cart" aria-label={`Keranjang, ${count} barang`}>
          <Button variant="ghost" size="icon-lg" className="relative text-ink-muted">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                {count}
              </span>
            )}
          </Button>
        </Link>

        <Button
          variant="ghost"
          size="icon-lg"
          className="text-ink-muted"
          onClick={lock}
          aria-label="Kunci layar"
        >
          <Lock className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Menu akun"
            className="ml-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(username ?? "S").charAt(0).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <p className="truncate">{user?.email ?? "Akun"}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {isOwner ? "Pemilik" : "Kasir"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isOwner && (
              <DropdownMenuItem aria-label="Pengaturan" render={<Link href="/settings" />}>
                <Cog className="size-4" />
                Pengaturan
              </DropdownMenuItem>
            )}
            <DropdownMenuItem aria-label="Kunci layar" onClick={lock}>
              <Lock className="size-4" />
              Kunci Layar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setLogoutOpen(true)}>
              <LogOut className="size-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </header>
  )
}