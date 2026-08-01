"use client"

import { Plus } from "@/components/ui/icons"
import { ProductPrice, ProductThumb, StockBadge } from "@/components/products/product-view"
import { cn } from "@/lib/utils"
import type { BxProduct } from "@/components/products/types"

export function ProductCard({
  p,
  qty,
  popKey,
  discount = 0,
  hasVariants = false,
  onAdd,
}: {
  p: BxProduct
  qty: number
  popKey: number
  discount?: number
  hasVariants?: boolean
  onAdd: () => void
}) {
  const out = p.stock <= 0
  const hasDisc = discount > 0
  const net = p.price_sell - discount
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
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <ProductThumb
          p={p}
          discount={discount}
          showSoldOut
          className="size-full"
          iconClassName="size-8"
        />
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
        <p className="truncate text-xs text-ink-muted">
          {hasVariants && (
            <span className="font-medium text-primary">Varian</span>
          )}
          {hasVariants && p.categories?.name ? " · " : ""}
          {p.categories?.name}
          {p.unit && p.unit !== "pcs" ? ` · ${p.unit}` : ""}
        </p>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <ProductPrice price={net} original={hasDisc ? p.price_sell : undefined} />
          {!out && p.stock <= (p.min_stock || 5) && (
            <StockBadge stock={p.stock} min={p.min_stock || 5} />
          )}
        </div>
      </div>
    </button>
  )
}

export function ProductRow({
  p,
  qty,
  discount = 0,
  hasVariants = false,
  onAdd,
}: {
  p: BxProduct
  qty: number
  discount?: number
  hasVariants?: boolean
  onAdd: () => void
}) {
  const out = p.stock <= 0
  const hasDisc = discount > 0
  const net = p.price_sell - discount
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-hairline bg-canvas p-2.5",
        out && "opacity-40"
      )}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={out}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative size-11 shrink-0">
          <ProductThumb p={p} showSoldOut className="size-11 rounded-lg" iconClassName="size-5" />
          {qty > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {qty}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{p.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {hasVariants && (
              <span className="font-medium text-primary">Varian</span>
            )}
            {hasVariants && p.categories?.name ? " · " : ""}
            {p.categories?.name}
            {p.unit && p.unit !== "pcs" ? ` · ${p.unit}` : ""}
          </p>
          <ProductPrice price={net} original={hasDisc ? p.price_sell : undefined} />
          {!out && p.stock <= (p.min_stock || 5) && (
            <StockBadge stock={p.stock} min={p.min_stock || 5} />
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onAdd}
        disabled={out}
        aria-label={`Tambah ${p.name} ke keranjang`}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:bg-primary-active disabled:opacity-40"
      >
        <Plus className="size-5" />
      </button>
    </div>
  )
}
