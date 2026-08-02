"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ChevronRight, Refresh, X } from "@/components/ui/icons"
import {
  availableQuickActions,
  defaultQuickActions,
  getActionByKey,
  loadQuickActions,
  saveQuickActions,
  isActionForRole,
  type QuickAction,
  type QuickActionKey,
} from "@/lib/quick-actions"
import { useAuth } from "@/lib/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/hooks/use-role"
import { cn } from "@/lib/utils"

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        on ? "bg-primary" : "border border-hairline bg-canvas-soft"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5"
        )}
      />
    </button>
  )
}

function ActionRow({
  action,
  active,
  index,
  total,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  action: QuickAction
  active: boolean
  index: number
  total: number
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const Icon = action.icon
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{action.label}</p>
        <p className="truncate text-xs text-ink-faint">{action.desc}</p>
      </div>
      {active && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Pindah ${action.label} ke atas`}
            disabled={index === 0}
            onClick={onMoveUp}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors disabled:opacity-30 active:bg-canvas-soft"
          >
            <ChevronRight className="-rotate-90 size-4" />
          </button>
          <button
            type="button"
            aria-label={`Pindah ${action.label} ke bawah`}
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors disabled:opacity-30 active:bg-canvas-soft"
          >
            <ChevronRight className="rotate-90 size-4" />
          </button>
        </div>
      )}
      <Toggle on={active} onToggle={onToggle} />
    </div>
  )
}

function QuickActionsSheet({
  open,
  onOpenChange,
  role,
  storeId,
  userId,
  initialKeys,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  role: UserRole
  storeId: string
  userId: string
  initialKeys: QuickActionKey[]
  onSaved: (keys: QuickActionKey[]) => void
}) {
  const all = useMemo(() => availableQuickActions(role), [role])
  const [draft, setDraft] = useState<QuickActionKey[]>(initialKeys)

  function toggle(key: QuickActionKey) {
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]))
  }

  function move(key: QuickActionKey, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.length) return d
      const next = [...d]
      next[i] = next[j]
      next[j] = d[i]
      return next
    })
  }

  function reset() {
    setDraft(defaultQuickActions(role))
  }

  function save() {
    saveQuickActions(storeId, userId, draft)
    onSaved(draft)
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="rounded-t-xl">
        <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
          <div>
            <DrawerTitle>Atur Aksi Cepat</DrawerTitle>
            <DrawerDescription className="text-xs">
              Pilih menu yang sering dibuka & atur urutannya.
            </DrawerDescription>
          </div>
          <DrawerClose className="-mr-1.5 rounded-full p-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-5" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {all.map((action) => {
            const active = draft.includes(action.key)
            return (
              <ActionRow
                key={action.key}
                action={action}
                active={active}
                index={draft.indexOf(action.key)}
                total={draft.length}
                onToggle={() => toggle(action.key)}
                onMoveUp={() => move(action.key, -1)}
                onMoveDown={() => move(action.key, 1)}
              />
            )
          })}
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={reset}>
            <Refresh className="size-3.5" />
            Reset ke bawaan
          </Button>
          <Button onClick={save}>Simpan</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// Aksi Cepat di puncak Dashboard: shortcut menu yang paling sering dibuka,
// bisa diatur sendiri (aktif/nonaktif + urutan), tersimpan per toko per user.
export function QuickActions({ role }: { role: UserRole | null | undefined }) {
  const { user } = useAuth()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [keys, setKeys] = useState<QuickActionKey[] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const userId = user?.id

  useEffect(() => {
    if (role == null || !userId) return
    let active = true
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc("current_store_id")
      if (!active) return
      const sid = data as string | null
      setStoreId(sid)
      if (!sid) {
        setKeys([])
        return
      }
      const stored = loadQuickActions(sid, userId)
      const resolved = stored ?? defaultQuickActions(role)
      // Filter aksi yang tidak lagi boleh untuk peran (mis. peran berubah).
      setKeys(resolved.filter((k) => {
        const action = getActionByKey(k)
        return action ? isActionForRole(action, role) : false
      }))
    })()
    return () => {
      active = false
    }
  }, [role, userId])

  if (role == null || keys === null || storeId == null || !userId) return null

  const actions = keys
    .map((k) => getActionByKey(k))
    .filter((a): a is QuickAction => !!a)

  return (
    <section aria-label="Aksi Cepat" className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Aksi Cepat</h2>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-0.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold text-ink transition-colors active:bg-canvas-soft"
        >
          Atur
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-ink-faint">
          Belum ada aksi cepat. Ketuk <span className="font-semibold text-ink-muted">Atur</span> untuk
          memilih menu.
        </p>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.key}
                href={action.href}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-canvas-soft text-ink">
                  <Icon className="size-5" />
                </span>
                <span className="text-center text-[11px] font-medium leading-tight text-ink-muted">
                  {action.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <QuickActionsSheet
        key={sheetOpen ? "quick-actions-open" : "quick-actions-closed"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        role={role}
        storeId={storeId}
        userId={userId}
        initialKeys={keys}
        onSaved={setKeys}
      />
    </section>
  )
}
