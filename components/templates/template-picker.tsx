"use client"

import type React from "react"
import { storeTemplateOptions, type StoreTemplateOption } from "@/lib/templates/options"
import { Check, Package, ShoppingBag, Store, Tag } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const ICONS: Record<StoreTemplateOption["icon"], React.ComponentType<{ className?: string }>> = {
  store: Store,
  food: ShoppingBag,
  kiosk: Tag,
  home: Package,
  empty: Package,
}

export function TemplatePicker({
  value,
  onChange,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn(compact ? "grid grid-cols-2 gap-2" : "space-y-2")}>
      {storeTemplateOptions.map((template) => {
        const Icon = ICONS[template.icon]
        const active = value === template.key
        return (
          <button
            key={template.key}
            type="button"
            onClick={() => onChange(template.key)}
            className={cn(
              "relative flex w-full min-w-0 rounded-xl border text-left transition-colors active:bg-canvas-soft",
              compact ? "min-h-20 flex-col items-start gap-2 p-3" : "items-center gap-3 p-3",
              compact && template.key === "kosong" && "col-span-2 min-h-0 flex-row items-center",
              active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-hairline bg-canvas"
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg",
                compact ? "size-8" : "size-9",
                active ? "bg-primary text-primary-foreground" : "bg-black/[0.05] text-ink-muted"
              )}
            >
              <Icon className={compact ? "size-3.5" : "size-4"} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-semibold text-ink", compact ? "text-[13px]" : "text-sm")}>{template.name}</span>
              {!compact && <span className="block text-xs text-ink-faint">{template.desc}</span>}
              {compact && template.key === "kelontong" && (
                <span className="mt-0.5 block text-[10px] font-semibold text-primary">Direkomendasikan</span>
              )}
              {compact && template.key !== "kelontong" && template.productCount > 0 && (
                <span className="mt-0.5 block text-[10px] font-medium text-ink-faint">
                  {template.productCount} produk
                </span>
              )}
              {!compact && template.productCount > 0 && (
                <span className="mt-1 block text-[11px] font-medium text-ink-muted">
                  {template.productCount} barang contoh
                </span>
              )}
            </span>
            {active && (
              <Check className={cn("size-5 shrink-0 text-primary", compact && "absolute right-2.5 top-2.5")} />
            )}
          </button>
        )
      })}
    </div>
  )
}
