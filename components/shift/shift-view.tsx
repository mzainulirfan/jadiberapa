"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getActiveShift,
  getShifts,
  getShiftSummary,
  type BxCashSession,
} from "@/lib/db/queries"
import { openShift, closeShift } from "@/lib/actions/shifts"
import { Wallet, Plus, X } from "@/components/ui/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

const formatThousands = (raw: string) => (raw ? Number(raw).toLocaleString("id-ID") : "")
const onlyDigits = (s: string) => s.replace(/\D/g, "")
const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`
const fmtDate = (d: string) => format(new Date(d), "dd MMM yyyy, HH:mm", { locale: localeId })

export function ShiftView() {
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<BxCashSession | null>(null)
  const [history, setHistory] = useState<BxCashSession[]>([])
  const [cashSales, setCashSales] = useState(0)
  const [txCount, setTxCount] = useState(0)

  const [openDrawer, setOpenDrawer] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)
  const [openingInput, setOpeningInput] = useState("")
  const [closingInput, setClosingInput] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const shift = await getActiveShift()
    setActive(shift)
    if (shift) {
      const s = await getShiftSummary(shift.opened_at)
      setCashSales(s.cashSales)
      setTxCount(s.txCount)
    } else {
      setCashSales(0)
      setTxCount(0)
    }
    setHistory(await getShifts(20))
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const shift = await getActiveShift()
      const [summary, shifts] = await Promise.all([
        shift ? getShiftSummary(shift.opened_at) : Promise.resolve({ cashSales: 0, txCount: 0 }),
        getShifts(20),
      ])
      if (active) {
        setActive(shift)
        setCashSales(summary.cashSales)
        setTxCount(summary.txCount)
        setHistory(shifts)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const expected = active ? active.opening + cashSales : 0
  const closingAmount = Number(closingInput.replace(/\D/g, "")) || 0
  const diffPreview = closingAmount - expected

  async function handleOpen() {
    const amt = Number(openingInput.replace(/\D/g, "")) || 0
    setSaving(true)
    try {
      const res = await openShift(amt)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Shift dibuka")
      setOpenDrawer(false)
      setOpeningInput("")
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleClose() {
    if (!active) return
    setSaving(true)
    try {
      const res = await closeShift(active.id, closingAmount, note)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Shift ditutup")
      setCloseDrawer(false)
      setClosingInput("")
      setNote("")
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      {loading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-hairline bg-canvas p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-32 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-3 h-3 w-32 rounded-full" />
            <Skeleton className="mt-2 h-8 w-44 rounded-md" />
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-2.5 w-14 rounded-full" />
                  <Skeleton className="mt-1.5 h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-3 h-11 w-full rounded-full" />
          </div>

          <div>
            <Skeleton className="mb-2 h-4 w-28 rounded-md" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-hairline bg-canvas p-3.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-40 rounded-full" />
                  <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-hairline pt-2.5">
                    {[0, 1, 2].map((j) => (
                      <div key={j}>
                        <Skeleton className="h-2.5 w-12 rounded-full" />
                        <Skeleton className="mt-1.5 h-3.5 w-14 rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : active ? (
        <ActiveShiftCard
          shift={active}
          cashSales={cashSales}
          txCount={txCount}
          expected={expected}
          onClose={() => {
            setClosingInput(expected ? expected.toLocaleString("id-ID") : "")
            setNote("")
            setCloseDrawer(true)
          }}
        />
      ) : (
        <div className="rounded-2xl border border-hairline bg-canvas p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </span>
            <p className="text-sm font-medium text-ink-muted">Shift Kasir</p>
          </div>
          <p className="mt-3 text-sm text-ink">Belum ada shift aktif.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Buka shift dengan mengisi saldo awal laci untuk mulai memantau kas.
          </p>
          <Button
            className="mt-3 w-full rounded-full gap-1.5"
            onClick={() => {
              setOpeningInput("")
              setOpenDrawer(true)
            }}
          >
            <Plus className="size-4" /> Buka Shift
          </Button>
        </div>
      )}

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-ink">Riwayat Shift</h2>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">Belum ada shift yang ditutup</p>
        ) : (
          <div className="space-y-2">
            {history.map((s) => (
              <div key={s.id} className="rounded-xl border border-hairline bg-canvas p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{fmtDate(s.opened_at)}</p>
                  <DiffBadge diff={s.diff ?? 0} />
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Tutup: {s.closed_at ? fmtDate(s.closed_at) : "-"}
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-hairline pt-2.5 text-xs">
                  <Cell label="Saldo Awal" value={fmtRp(s.opening)} />
                  <Cell label="Seharusnya" value={fmtRp(s.expected ?? 0)} />
                  <Cell label="Fisik" value={fmtRp(s.closing ?? 0)} />
                </div>
                {s.note && <p className="mt-2 text-xs text-ink-muted">Catatan: {s.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Buka shift */}
      <Drawer open={openDrawer} onOpenChange={setOpenDrawer} showSwipeHandle>
        <DrawerContent className="rounded-t-xl">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
            <DrawerTitle>Buka Shift</DrawerTitle>
            <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="opening" className="text-xs text-ink-muted mb-1 block">
                Saldo awal laci
              </label>
              <InputGroup>
                <InputGroupAddon>Rp</InputGroupAddon>
                <InputGroupInput
                  id="opening"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatThousands(onlyDigits(openingInput))}
                  onChange={(e) => setOpeningInput(onlyDigits(e.target.value))}
                  autoFocus
                />
              </InputGroup>
              <p className="mt-1 text-xs text-ink-faint">
                Jumlah uang tunai di laci saat mulai jaga.
              </p>
            </div>
            <div className="border-t border-hairline bg-canvas p-4 -mx-4 -mb-4 mt-4 rounded-b-xl">
              <Button
                className="w-full rounded-full h-11 text-base"
                disabled={saving}
                onClick={handleOpen}
              >
                {saving ? "Menyimpan..." : "Mulai Shift"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Tutup shift */}
      <Drawer open={closeDrawer} onOpenChange={setCloseDrawer} showSwipeHandle>
        <DrawerContent className="rounded-t-xl">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 border-b border-hairline text-left">
            <DrawerTitle>Tutup Shift</DrawerTitle>
            <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-hairline bg-canvas-soft p-3 text-sm space-y-1.5">
              <Row label="Saldo awal" value={fmtRp(active?.opening ?? 0)} />
              <Row label="Penjualan tunai" value={fmtRp(cashSales)} />
              <div className="flex justify-between border-t border-hairline pt-1.5 font-semibold text-ink">
                <span>Kas seharusnya</span>
                <span>{fmtRp(expected)}</span>
              </div>
            </div>
            <div>
              <label htmlFor="closing" className="text-xs text-ink-muted mb-1 block">
                Kas fisik (hitung uang di laci)
              </label>
              <InputGroup>
                <InputGroupAddon>Rp</InputGroupAddon>
                <InputGroupInput
                  id="closing"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatThousands(onlyDigits(closingInput))}
                  onChange={(e) => setClosingInput(onlyDigits(e.target.value))}
                  autoFocus
                />
              </InputGroup>
            </div>
            {closingInput !== "" && (
              <div className="flex items-center justify-between rounded-xl border border-hairline p-3 text-sm">
                <span className="text-ink-muted">Selisih</span>
                <span
                  className={cn(
                    "font-semibold",
                    diffPreview === 0
                      ? "text-accent-green"
                      : diffPreview > 0
                        ? "text-primary"
                        : "text-destructive"
                  )}
                >
                  {diffPreview > 0 ? "+" : ""}
                  {fmtRp(diffPreview)}
                  {diffPreview !== 0 && (
                    <span className="ml-1 text-xs font-normal">
                      ({diffPreview > 0 ? "lebih" : "kurang"})
                    </span>
                  )}
                </span>
              </div>
            )}
            <div>
              <label htmlFor="shift-note" className="text-xs text-ink-muted mb-1 block">
                Catatan <span className="text-ink-faint">(opsional)</span>
              </label>
              <Input
                id="shift-note"
                placeholder="Contoh: selisih karena kembalian"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="border-t border-hairline bg-canvas p-4 -mx-4 -mb-4 mt-4 rounded-b-xl">
              <Button
                className="w-full rounded-full h-11 text-base"
                disabled={saving || closingInput === ""}
                onClick={handleClose}
              >
                {saving ? "Menyimpan..." : "Tutup Shift"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function ActiveShiftCard({
  shift,
  cashSales,
  txCount,
  expected,
  onClose,
}: {
  shift: BxCashSession
  cashSales: number
  txCount: number
  expected: number
  onClose: () => void
}) {
  const duration = useMemo(() => fmtDate(shift.opened_at), [shift.opened_at])
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
          <Wallet className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Shift Aktif</p>
          <p className="text-xs text-ink-faint">Dibuka {duration}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">Kas seharusnya di laci</p>
      <p className="text-[30px] font-bold leading-none tracking-tight text-ink">{fmtRp(expected)}</p>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
        <Cell label="Saldo Awal" value={fmtRp(shift.opening)} />
        <Cell label="Penjualan Tunai" value={fmtRp(cashSales)} />
        <Cell label="Transaksi" value={String(txCount)} />
      </div>
      <Button variant="destructive" className="mt-3 w-full rounded-full" onClick={onClose}>
        Tutup Shift
      </Button>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-ink">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-muted">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}

function DiffBadge({ diff }: { diff: number }) {
  const label = diff === 0 ? "Pas" : diff > 0 ? `+${fmtRp(diff)}` : fmtRp(diff)
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        diff === 0
          ? "bg-emerald-50 text-emerald-700"
          : diff > 0
            ? "bg-blue-50 text-blue-700"
            : "bg-red-50 text-red-700"
      )}
    >
      {label}
    </span>
  )
}
