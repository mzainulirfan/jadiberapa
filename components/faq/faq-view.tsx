"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { faqGroups, type FaqGroup, type FaqItem } from "@/lib/faq/content"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  Store,
  Package,
  Receipt,
  ChartLine,
  Search,
  HelpCircle,
  ArrowRight,
} from "@/components/ui/icons"

const GROUP_ICONS: Record<FaqGroup["icon"], ComponentType<{ className?: string }>> = {
  store: Store,
  package: Package,
  receipt: Receipt,
  chart: ChartLine,
}

const ITEM_ANCHOR = (id: string) => `faq-${id}`

function normalize(s: string) {
  return s.toLowerCase().trim()
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function ArticleCard({ item }: { item: FaqItem }) {
  return (
    <article
      id={ITEM_ANCHOR(item.id)}
      data-faq-section={ITEM_ANCHOR(item.id)}
      className="scroll-mt-24 rounded-xl border border-hairline bg-canvas p-4 sm:p-5"
    >
      <h3 className="text-[15px] font-semibold text-ink">{item.q}</h3>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-muted">{item.a}</p>
      {item.href && (
        <Link
          href={item.href}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
        >
          Buka halaman terkait
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </article>
  )
}

function GroupSection({ group }: { group: FaqGroup }) {
  const Icon = GROUP_ICONS[group.icon]
  return (
    <section id={`grp-${group.id}`} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-[-0.3px] text-ink">{group.title}</h2>
          {group.desc && <p className="text-xs text-ink-muted">{group.desc}</p>}
        </div>
      </div>
      <div className="space-y-3">
        {group.items.map((item) => (
          <ArticleCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export function FaqView() {
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)

  const searching = query.trim().length > 0

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

  useEffect(() => {
    if (searching) return
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-faq-section]"))
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute("data-faq-section"))
          }
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [searching])

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-auto bg-canvas-soft">
      <div className="mx-auto flex min-h-full w-full flex-col">
        <header className="sticky top-0 z-20 border-b border-hairline bg-canvas">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
                S
              </span>
              <span className="text-sm font-bold tracking-[-0.2px] text-ink">Saberaha</span>
            </Link>
            <span className="hidden text-xs text-ink-faint sm:inline">Pusat Bantuan</span>
            <div className="ml-auto flex items-center">
              {user ? (
                <Link
                  href="/more"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Ke Aplikasi
                </Link>
              ) : (
                <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
                  Masuk
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <aside className="sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] self-start overflow-y-auto py-8 pr-1 lg:block">
          <div className="relative mb-6">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bantuan…"
              className="pl-10"
              aria-label="Cari bantuan"
            />
          </div>
          <nav className="space-y-6">
            {faqGroups.map((group) => (
              <div key={group.id}>
                <p className="px-2.5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  {group.title}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {group.items.map((item) => {
                    const anchor = ITEM_ANCHOR(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => scrollToId(anchor)}
                          className={cn(
                            "w-full rounded-lg px-2.5 py-1.5 text-left text-sm leading-snug text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink",
                            !searching && activeId === anchor && "bg-canvas-soft font-medium text-ink"
                          )}
                        >
                          {item.q}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 py-8">
          <div className="space-y-1">
            <h1 className="text-[26px] font-bold tracking-[-0.625px] text-ink">Bantuan & FAQ</h1>
            <p className="text-sm text-ink-muted">
              Jawaban cepat untuk memulai dan mengelola toko dengan Saberaha.
            </p>
          </div>

          <div className="relative mt-5 lg:hidden">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bantuan…"
              className="pl-10"
              aria-label="Cari bantuan"
            />
          </div>

          {!searching && (
            <div className="sticky top-14 z-10 mt-5 -mx-4 flex gap-2 overflow-x-auto border-b border-hairline bg-canvas-soft px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden">
              {faqGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => scrollToId(`grp-${group.id}`)}
                  className="shrink-0 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink-muted active:bg-canvas-soft"
                >
                  {group.title}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-12">
            {searching ? (
              matches.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-ink">
                    Hasil untuk “{query.trim()}”
                  </p>
                  {matches.map(({ item }) => (
                    <ArticleCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-canvas px-4 py-12 text-center">
                  <HelpCircle className="size-8 text-ink-faint" />
                  <p className="text-sm font-medium text-ink">Tidak ada hasil</p>
                  <p className="text-xs text-ink-faint">Coba kata kunci lain.</p>
                </div>
              )
            ) : (
              faqGroups.map((group) => <GroupSection key={group.id} group={group} />)
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-hairline bg-canvas">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-0.5 px-4 py-6 text-center sm:px-6">
          <p className="text-xs font-medium text-ink">Saberaha — Kasir warung & UMKM</p>
          <p className="text-xs text-ink-faint">Pusat Bantuan · v1.0.0</p>
        </div>
      </footer>
        </div>
    </div>
  )
}
