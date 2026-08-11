"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart/cart-provider"
import { CartItems } from "./cart-items"
import { cn } from "@/lib/utils"

// Panel keranjang desktop pada split-pane Kasir. Berbagi state & kalkulasi dari
// CartProvider; komponen ini hanya penyajian. Route /cart tetap dipakai mobile,
// akses penuh (held carts, hapus semua), dan fallback navigasi langsung.
export function CartPanel({ className }: { className?: string }) {
  const { count, netTotal } = useCart()
  const router = useRouter()

  return (
    <aside
      className={cn(
        "min-h-0 flex-col border-l border-hairline bg-canvas",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Keranjang</h2>
        <span className="text-xs text-ink-muted">{count} item</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CartItems />
      </div>

      <div className="shrink-0 space-y-2 border-t border-hairline p-4 pb-5">
        <div className="flex items-end justify-between px-1">
          <span className="pb-1 text-sm text-ink-muted">Total ({count} item)</span>
          <span className="text-2xl font-bold tracking-tight text-ink">
            Rp{netTotal.toLocaleString()}
          </span>
        </div>
        <Button
          onClick={() => router.push("/checkout")}
          className="h-12 w-full rounded-full text-base"
        >
          Lanjut ke Pembayaran
        </Button>
      </div>
    </aside>
  )
}