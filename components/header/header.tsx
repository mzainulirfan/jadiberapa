"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/components/cart/cart-provider"
import { ShoppingBag, ChevronLeft } from "@/components/ui/icons"

type RouteMeta = { title: string; back?: string; cart?: boolean }

const ROUTES: Record<string, RouteMeta> = {
  "/dashboard": { title: "Dashboard" },
  "/cashier": { title: "Kasir", cart: true },
  "/products": { title: "Barang" },
  "/transactions": { title: "Transaksi" },
  "/more": { title: "Lainnya" },
  "/customers": { title: "Pembeli", back: "/more" },
  "/categories": { title: "Kategori", back: "/more" },
  "/reports": { title: "Laporan", back: "/more" },
  "/settings": { title: "Pengaturan", back: "/more" },
  "/cart": { title: "Keranjang", back: "/cashier" },
  "/checkout": { title: "Pembayaran", back: "/cart" },
}

function resolveMeta(pathname: string): RouteMeta {
  if (pathname.startsWith("/transactions/") && pathname !== "/transactions") {
    return { title: "Detail Transaksi", back: "/transactions" }
  }
  return ROUTES[pathname] ?? { title: "Saberaha" }
}

export function Header() {
  const pathname = usePathname()
  const { count } = useCart()
  const meta = resolveMeta(pathname)

  return (
    <header className="flex min-h-[3.25rem] items-center gap-1 border-b border-hairline bg-canvas px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
      {meta.back && (
        <Link
          href={meta.back}
          aria-label="Kembali"
          className="-ml-1.5 flex size-9 items-center justify-center rounded-full text-ink-muted transition-transform duration-150 active:scale-90"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}

      <h1 className="flex-1 truncate text-[17px] font-bold tracking-[-0.3px] text-ink">
        {meta.title}
      </h1>

      {meta.cart && (
        <Link
          href="/cart"
          className="relative -mr-1 flex size-9 items-center justify-center rounded-full bg-black/[0.05] text-ink transition-transform duration-150 active:scale-90"
          aria-label={`Keranjang, ${count} barang`}
        >
          <ShoppingBag className="size-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
      )}
    </header>
  )
}
