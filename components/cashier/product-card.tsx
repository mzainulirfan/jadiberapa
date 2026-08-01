"use client"

import { Package, Plus } from "@/components/ui/icons"
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
        {hasDisc && !out && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-accent-orange px-2 py-0.5 text-[10px] font-semibold text-white">
            -Rp{discount.toLocaleString("id-ID")}
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
        <p className="truncate text-xs text-ink-muted">
          {hasVariants && (
            <span className="font-medium text-primary">Varian</span>
          )}
          {hasVariants && p.categories?.name ? " · " : ""}
          {p.categories?.name ?? "Tanpa kategori"}
          {p.unit && p.unit !== "pcs" ? ` · ${p.unit}` : ""}
        </p>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-baseline gap-1">
            <p className="text-sm font-semibold text-primary">
              Rp{hasDisc ? net : p.price_sell}
            </p>
            {hasDisc && (
              <span className="text-[11px] text-ink-faint line-through">
                Rp{p.price_sell.toLocaleString()}
              </span>
            )}
          </div>
          {!out && p.stock <= 5 && (
            <span className="text-[11px] font-medium text-accent-orange">Stok {p.stock}</span>
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
          <div className="size-11 overflow-hidden rounded-lg bg-canvas-soft">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="flex size-full items-center justify-center text-ink-faint">
                <Package className="size-5" />
              </div>
            )}
          </div>
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
            {p.categories?.name ?? "Tanpa kategori"}
            {p.unit && p.unit !== "pcs" ? ` · ${p.unit}` : ""}
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-sm font-semibold text-primary">Rp{hasDisc ? net : p.price_sell}</p>
            {hasDisc && (
              <span className="text-[11px] text-ink-faint line-through">
                Rp{p.price_sell.toLocaleString()}
              </span>
            )}
          </div>
          {out ? (
            <p className="text-[11px] font-semibold text-destructive">Habis</p>
          ) : (
            p.stock <= 5 && <p className="text-[11px] font-medium text-accent-orange">Stok {p.stock}</p>
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
