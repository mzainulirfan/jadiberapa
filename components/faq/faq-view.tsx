"use client"

import { useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { faqGroups, type FaqGroup, type FaqItem } from "@/lib/faq/content"
import {
  Store,
  Package,
  Receipt,
  ChartLine,
  Search,
  ChevronDown,
  HelpCircle,
} from "@/components/ui/icons"

const GROUP_ICONS: Record<FaqGroup["icon"], ComponentType<{ className?: string }>> = {
  store: Store,
  package: Package,
  receipt: Receipt,
  chart: ChartLine,
}

function normalize(s: string) {
  return s.toLowerCase().trim()
}

function ItemCard({
  item,
  expanded,
  onToggle,
}: {
  item: FaqItem
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors active:bg-canvas-soft"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{item.q}</p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform duration-150",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-hairline px-3.5 pt-3 pb-3.5">
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-muted">{item.a}</p>
          {item.href && (
            <Link
              href={item.href}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
            >
              Buka halaman terkait
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export function FaqView() {
  const [query, setQuery] = useState("")
  const [openGroups, setOpenGroups] = useState<string[]>([faqGroups[0].id])
  const [openItems, setOpenItems] = useState<string[]>([])

  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    const result: { group: FaqGroup; item: FaqItem }[] = []
    for (const group of faqGroups) {
      for (const item of group.items) {
        if (
          normalize(group.title).includes(q) ||
          normalize(item.q).includes(q) ||
          normalize(item.a).includes(q)
        ) {
          result.push({ group, item })
        }
      }
    }
    return result
  }, [query])

  function toggleGroup(id: string) {
    setOpenGroups((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleItem(id: string) {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const searching = query.trim().length > 0

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-1">
        <h1 className="text-[22px] font-bold tracking-[-0.5px] text-ink">Bantuan & FAQ</h1>
        <p className="text-sm text-ink-muted">
          Jawaban cepat untuk memulai dan mengelola toko dengan Saberaha.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari bantuan…"
          className="pl-10"
          aria-label="Cari bantuan"
        />
      </div>

      {searching ? (
        matches.length > 0 ? (
          <div className="space-y-2">
            {matches.map(({ item }) => (
              <ItemCard
                key={item.id}
                item={item}
                expanded
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-canvas px-4 py-10 text-center">
            <HelpCircle className="size-8 text-ink-faint" />
            <p className="text-sm font-medium text-ink">Tidak ada hasil</p>
            <p className="text-xs text-ink-faint">Coba kata kunci lain.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {faqGroups.map((group) => {
            const Icon = GROUP_ICONS[group.icon]
            const open = openGroups.includes(group.id)
            return (
              <div key={group.id} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center gap-2.5 px-1 py-1 text-left"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="flex-1 text-sm font-semibold text-ink">{group.title}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-ink-faint transition-transform duration-150",
                      open && "rotate-180"
                    )}
                  />
                </button>
                {open && (
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        expanded={openItems.includes(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
