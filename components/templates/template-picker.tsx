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
    <div className="space-y-2">
      {storeTemplateOptions.map((template) => {
        const Icon = ICONS[template.icon]
        const active = value === template.key
        return (
          <button
            key={template.key}
            type="button"
            onClick={() => onChange(template.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:bg-canvas-soft",
              active ? "border-primary bg-primary/5" : "border-hairline bg-canvas"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-primary text-primary-foreground" : "bg-black/[0.05] text-ink-muted"
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{template.name}</span>
              <span className="block text-xs text-ink-faint">{template.desc}</span>
              {!compact && template.productCount > 0 && (
                <span className="mt-1 block text-[11px] font-medium text-ink-muted">
                  {template.productCount} barang contoh
                </span>
              )}
            </span>
            {active && <Check className="size-5 shrink-0 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}
