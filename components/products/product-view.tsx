import { Badge } from "@/components/ui/badge"
import { Package } from "@/components/ui/icons"
import { fmtRp } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { BxProduct } from "./types"

export function ProductThumb({
  p,
  className,
  discount = 0,
  showCategory = false,
  showSoldOut = false,
  iconClassName = "size-6",
}: {
  p: BxProduct
  className?: string
  discount?: number
  showCategory?: boolean
  showSoldOut?: boolean
  iconClassName?: string
}) {
  const out = p.stock <= 0
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-canvas-soft text-ink-faint",
        className
      )}
    >
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className={iconClassName} />
      )}
      {showSoldOut && out && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-white">
          Habis
        </span>
      )}
      {discount > 0 && !out && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-accent-orange px-2 py-0.5 text-[10px] font-semibold text-white">
          -{fmtRp(discount)}
        </span>
      )}
      {showCategory && p.categories?.name && (
        <span className="absolute right-1.5 top-1.5 max-w-[75%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {p.categories.name}
        </span>
      )}
    </div>
  )
}

export function ProductPrice({
  price,
  original,
  className,
  originalClassName,
}: {
  price: number
  original?: number
  className?: string
  originalClassName?: string
}) {
  const hasDisc = original != null && original > price
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-sm font-semibold text-primary">{fmtRp(price)}</span>
      {hasDisc && (
        <span className={cn("text-[11px] text-ink-faint line-through", originalClassName)}>
          {fmtRp(original!)}
        </span>
      )}
    </span>
  )
}

export function StockBadge({ stock, min = 5 }: { stock: number; min?: number }) {
  if (stock <= 0) return <Badge variant="destructive">Habis</Badge>
  if (stock <= min)
    return (
      <Badge variant="outline" className="border-accent-orange/30 bg-accent-orange/10 text-accent-orange">
        Stok {stock}
      </Badge>
    )
  return null
}
