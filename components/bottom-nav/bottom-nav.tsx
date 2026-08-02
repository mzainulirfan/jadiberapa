"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Dashboard as DashboardIcon,
  CartAlt as CashierIcon,
  Package as PackageIcon,
  Receipt as ReceiptIcon,
  DotsHorizontalRounded as MoreIcon,
} from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const sideNav = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/products", label: "Barang", icon: PackageIcon },
  { href: "/transactions", label: "Transaksi", icon: ReceiptIcon },
  { href: "/more", label: "Lainnya", icon: MoreIcon },
]

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-1.5 text-[12px] font-semibold leading-[1.33] tracking-[0.125px] transition-colors",
        active ? "text-primary" : "text-ink-faint"
      )}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const cashierActive = pathname.startsWith("/cashier")

  return (
    <nav className="grid grid-cols-5 items-center border-t border-hairline bg-canvas px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
      {sideNav.slice(0, 2).map((item) => (
        <NavTab
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname.startsWith(item.href)}
        />
      ))}

      <div className="flex items-center justify-center">
        <Link
          href="/cashier"
          aria-label="Kasir"
          className={cn(
            "flex size-13 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-all active:scale-95",
            cashierActive ? "bg-primary-active" : "bg-primary"
          )}
        >
          <CashierIcon className="size-6" />
        </Link>
      </div>

      {sideNav.slice(2).map((item) => (
        <NavTab
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname.startsWith(item.href)}
        />
      ))}
    </nav>
  )
}

