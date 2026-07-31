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

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/transactions", label: "Transaksi", icon: ReceiptIcon },
  { href: "/cashier", label: "Kasir", icon: CashierIcon },
  { href: "/products", label: "Barang", icon: PackageIcon },
  { href: "/more", label: "Lainnya", icon: MoreIcon },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center justify-around border-t border-hairline bg-canvas px-2 py-1">
      {mainNav.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[12px] font-semibold leading-[1.33] tracking-[0.125px] transition-colors",
              isActive ? "text-primary" : "text-ink-faint"
            )}
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

