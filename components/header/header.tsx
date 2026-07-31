"use client"

import Link from "next/link"
import { useCart } from "@/components/cart/cart-provider"
import { ShoppingBag } from "@/components/ui/icons"

export function Header() {
  const { count } = useCart()

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-canvas">
      <p className="text-base font-bold tracking-[-0.3px] text-ink">JadiBerapa</p>
      <Link
        href="/cart"
        className="relative flex size-11 items-center justify-center rounded-full bg-black/[0.05] text-ink transition-transform duration-150 active:scale-90"
        aria-label={`Keranjang, ${count} barang`}
      >
        <ShoppingBag className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
            {count}
          </span>
        )}
      </Link>
    </header>
  )
}
