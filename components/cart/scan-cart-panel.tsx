"use client"

import { Button } from "@/components/ui/button"
import { useCart } from "@/components/cart/cart-provider"
import { CartItems } from "@/components/cart/cart-items"
import { CartAlt } from "@/components/ui/icons"

// Panel bawah pada mode scan split (mobile): menampilkan keranjang live agar
// kasir bisa melihat barang yang baru ter-scan tanpa menutup kamera.
export function ScanCartPanel({
  onDone,
  onCheckout,
}: {
  onDone: () => void
  onCheckout: () => void
}) {
  const { count, netTotal } = useCart()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <CartAlt className="size-4" />
          Keranjang
        </h2>
        <span className="text-xs text-ink-muted">{count} item</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <CartItems />
      </div>

      <div className="shrink-0 border-t border-hairline bg-canvas p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-between px-1">
          <span className="pb-1 text-sm text-ink-muted">Total ({count} item)</span>
          <span className="text-2xl font-bold tracking-tight text-ink">
            Rp{netTotal.toLocaleString()}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onDone}
            className="h-11 flex-1 rounded-full"
          >
            Selesai Scan
          </Button>
          <Button onClick={onCheckout} className="h-11 flex-1 rounded-full">
            Bayar
          </Button>
        </div>
      </div>
    </div>
  )
}
