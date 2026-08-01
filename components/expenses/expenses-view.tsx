"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { getExpenses, type BxExpense } from "@/lib/db/queries"
import { createExpense, deleteExpense } from "@/lib/actions/expenses"
import { Plus, Trash, ChevronDown, Dollar, X } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

type RangeKey = "today" | "week" | "month" | "all"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "7 Hari" },
  { key: "month", label: "Bulan Ini" },
  { key: "all", label: "Semua" },
]

const CATEGORIES = [
  "Belanja Stok",
  "Operasional",
  "Gaji",
  "Sewa",
  "Listrik & Air",
  "Transport",
  "Lainnya",
]

const formatThousands = (raw: string) => (raw ? Number(raw).toLocaleString("id-ID") : "")
const onlyDigits = (s: string) => s.replace(/\D/g, "")
const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

const CATEGORY_COLORS = [
  "bg-accent-orange",
  "bg-accent-teal",
  "bg-accent-purple",
  "bg-accent-sky",
  "bg-accent-pink",
  "bg-accent-green",
  "bg-accent-brown",
]

function categoryColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length]
}

function fromForRange(range: RangeKey): string | undefined {
  const now = new Date()
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (range === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return undefined
}

export function ExpensesView() {
  const [expenses, setExpenses] = useState<BxExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>("month")
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BxExpense | null>(null)

  // Form
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getExpenses(fromForRange(range))
    setExpenses(data)
  }, [range])

  useEffect(() => {
    let active = true
    ;(async () => {
      const data = await getExpenses(fromForRange(range))
      if (active) {
        setExpenses(data)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [range])

  function changeRange(next: RangeKey) {
    setLoading(true)
    setRange(next)
  }

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const periodLabel = RANGES.find((r) => r.key === range)?.label ?? ""

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  function openAdd() {
    setAmount("")
    setCategory(CATEGORIES[0])
    setNote("")
    setAddOpen(true)
  }

  async function handleSave() {
    const amt = Number(amount) || 0
    if (amt <= 0) {
      toast.error("Isi nominal pengeluaran.")
      return
    }
    setSaving(true)
    try {
      const res = await createExpense(amt, category, note)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Pengeluaran dicatat")
      setAddOpen(false)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const res = await deleteExpense(id)
    if (res?.error) {
      toast.error("Gagal menghapus")
      return
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    toast.success("Pengeluaran dihapus")
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <PeriodDropdown value={range} onChange={changeRange} />
        <button
          onClick={openAdd}
          className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      </div>

      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Dollar className="size-4" />
          </span>
          <p className="text-sm font-medium text-ink-muted">Total Pengeluaran · {periodLabel}</p>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-40 rounded-md" />
        ) : (
          <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-ink">{fmtRp(total)}</p>
        )}
        {!loading && (
          <p className="mt-2 text-xs text-ink-faint">
            {expenses.length} catatan pengeluaran
            {byCategory.length > 0 && ` · ${byCategory.length} kategori`}
          </p>
        )}
      </div>

      {!loading && byCategory.length > 0 && (
        <div className="rounded-xl border border-hairline bg-canvas p-4">
          <h2 className="text-sm font-semibold text-ink">Per Kategori</h2>
          <div className="mt-3 space-y-2.5">
            {byCategory.map(([cat, amt]) => {
              const pct = total > 0 ? (amt / total) * 100 : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                      <span className={cn("size-2.5 shrink-0 rounded-full", categoryColor(cat))} />
                      <span className="truncate">{cat}</span>
                    </span>
                    <span className="shrink-0 font-medium text-ink">
                      {fmtRp(amt)} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-canvas-soft">
                    <div
                      className="h-full rounded-full bg-destructive/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-32 rounded-full" />
              </div>
              <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
              <Skeleton className="size-4 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-muted">Belum ada pengeluaran</p>
          <p className="mt-1 text-xs text-ink-faint">Catat biaya operasional agar laba bersih akurat.</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3.5">
              <span className={cn("size-2.5 shrink-0 rounded-full", categoryColor(e.category))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{e.category}</p>
                <p className="truncate text-xs text-ink-faint">
                  {e.note ? `${e.note} · ` : ""}
                  {format(new Date(e.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-ink">{fmtRp(e.amount)}</span>
              <button
                type="button"
                onClick={() => setDeleteTarget(e)}
                aria-label="Hapus pengeluaran"
                className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
              >
                <Trash className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Drawer open={addOpen} onOpenChange={setAddOpen} showSwipeHandle>
        <DrawerContent className="rounded-t-xl">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
            <DrawerTitle>Tambah Pengeluaran</DrawerTitle>
            <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label htmlFor="exp-amount" className="text-xs text-ink-muted mb-1 block">Nominal</label>
                <InputGroup>
                  <InputGroupAddon>Rp</InputGroupAddon>
                  <InputGroupInput
                    id="exp-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatThousands(amount)}
                    onChange={(e) => setAmount(onlyDigits(e.target.value))}
                    autoFocus
                  />
                </InputGroup>
              </div>

              <div>
                <p className="text-xs text-ink-muted mb-1.5">Kategori</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        category === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-hairline bg-canvas text-ink-muted active:bg-canvas-soft"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="exp-note" className="text-xs text-ink-muted mb-1 block">
                  Catatan <span className="text-ink-faint">(opsional)</span>
                </label>
                <Input
                  id="exp-note"
                  placeholder="Contoh: bayar listrik bulan ini"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                type="button"
                className="w-full rounded-full h-11 text-base"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Menyimpan..." : "Simpan Pengeluaran"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Pengeluaran?</DialogTitle>
            <DialogDescription>
              Catatan &quot;{deleteTarget?.category}&quot; sebesar {deleteTarget ? fmtRp(deleteTarget.amount) : ""} akan dihapus permanen dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PeriodDropdown({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const current = RANGES.find((r) => r.key === value)?.label ?? "Periode"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors outline-none active:bg-canvas-soft data-[popup-open]:bg-canvas-soft">
        {current}
        <ChevronDown className="size-3.5 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as RangeKey)}>
          {RANGES.map((r) => (
            <DropdownMenuRadioItem key={r.key} value={r.key} closeOnClick>
              {r.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
