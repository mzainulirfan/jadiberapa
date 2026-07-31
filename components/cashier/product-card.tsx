"use client"

import { Package } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { BxProduct } from "@/components/products/types"

export function ProductCard({
  p,
  qty,
  popKey,
  onAdd,
}: {
  p: BxProduct
  qty: number
  popKey: number
  onAdd: () => void
}) {
  const out = p.stock <= 0
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={out}
      className={cn(
        "relative overflow-hidden rounded-xl border border-hairline bg-canvas text-left transition-colors",
        out ? "opacity-40" : "hover:border-primary/30 active:border-primary/40"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas-soft">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-faint">
            <Package className="size-8" />
          </div>
        )}
        {out && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-white">
            Habis
          </span>
        )}
        {qty > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {qty}
          </span>
        )}
        {popKey > 0 && (
          <span key={popKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="animate-cart-pop rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">
              +1
            </span>
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium text-ink">{p.name}</p>
        <p className="truncate text-xs text-ink-muted">{p.categories?.name ?? "Tanpa kategori"}</p>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <p className="text-sm font-semibold text-primary">Rp{p.price_sell.toLocaleString()}</p>
          {!out && p.stock <= 5 && (
            <span className="text-[11px] font-medium text-amber-600">Stok {p.stock}</span>
          )}
        </div>
      </div>
    </button>
  )
}
