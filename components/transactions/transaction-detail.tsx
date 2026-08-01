"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getTransaction,
  getSettings,
  getPayments,
  type BxPayment,
} from "@/lib/db/queries"
import { recordPayment } from "@/lib/actions/transactions"
import { Printer, Share, X, Receipt, Copy } from "@/components/ui/icons"
import { Barcode, barcodeSvgString } from "@/components/ui/barcode"
import { isBluetoothPrintSupported, printReceiptBluetooth } from "@/lib/bluetooth-printer"

type Transaction = NonNullable<Awaited<ReturnType<typeof getTransaction>>["transaction"]>
type TxItem = {
  id: string
  qty: number
  subtotal: number
  discount?: number
  products?: { name?: string } | null
}

const methodLabel: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  dana: "DANA",
  utang: "Utang",
}

function buyerName(tx: Transaction) {
  return (tx as Transaction & { customers?: { name?: string } | null }).customers?.name
}

function paidOf(tx: Transaction) {
  return (tx as Transaction & { paid_amount?: number }).paid_amount ?? tx.total
}

function statusOf(tx: Transaction) {
  return (tx as Transaction & { status?: string }).status ?? "lunas"
}

function notaNo(tx: Transaction) {
  return (tx as Transaction & { number?: string | null }).number ?? tx.id.slice(0, 8).toUpperCase()
}

function discountOf(tx: Transaction) {
  return (tx as Transaction & { discount?: number }).discount ?? 0
}

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function formatDate(d: Date) {
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

function buildStrukLines(tx: Transaction, settings: Record<string, string>): string[] {
  const storeName = settings.store_name || "Toko Saya"
  const storeAddress = settings.store_address || ""
  const storePhone = settings.store_phone || ""
  const width = 32
  const sep = "-".repeat(width)
  const center = (s: string) => {
    const pad = Math.max(Math.floor((width - s.length) / 2), 0)
    return " ".repeat(pad) + s
  }
  const right = (s: string) => s.padStart(width)

  const d = new Date(tx.created_at)
  const dateStr = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

  const lines: string[] = []
  lines.push(center(storeName))
  if (storeAddress) lines.push(center(storeAddress))
  if (storePhone) lines.push(center(storePhone))
  lines.push(sep)
  lines.push(center("NOTA PENJUALAN"))
  lines.push(sep)
  lines.push(`No  : ${notaNo(tx)}`)
  lines.push(`Tgl : ${dateStr} ${timeStr}`)
  if (buyerName(tx)) lines.push(`Pembeli: ${buyerName(tx)}`)
  lines.push(sep)
  for (const item of tx.transaction_items as TxItem[]) {
    lines.push(`${item.qty} x ${item.products?.name ?? "Produk dihapus"}`)
    lines.push(right(fmtRp(item.subtotal - (item.discount ?? 0))))
  }
  lines.push(sep)
  const disc = discountOf(tx)
  const itemDisc = (tx.transaction_items as TxItem[]).reduce(
    (s, it) => s + (it.discount ?? 0),
    0
  )
  if (itemDisc > 0 || disc > 0) {
    lines.push(`Subtotal${right(fmtRp(tx.total + itemDisc + disc))}`)
    if (itemDisc > 0) lines.push(`Diskon Barang${right("-" + fmtRp(itemDisc))}`)
    if (disc > 0) lines.push(`Diskon${right("-" + fmtRp(disc))}`)
  }
  lines.push(`Total${right(fmtRp(tx.total))}`)
  lines.push(`Bayar: ${methodLabel[tx.payment_method] ?? tx.payment_method}`)
  if (statusOf(tx) === "utang") {
    lines.push(`Dibayar${right(fmtRp(paidOf(tx)))}`)
    lines.push(`Sisa${right(fmtRp(Math.max(0, tx.total - paidOf(tx))))}`)
  }
  lines.push(sep)
  lines.push(center("Terima kasih"))
  lines.push(center("Sampai jumpa kembali"))
  return lines
}

function buildStrukHtml(tx: Transaction, settings: Record<string, string>, barcodeSvg: string) {
  const lines = buildStrukLines(tx, settings)

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Struk</title>
<style>
  @page { margin: 8mm; }
  body { font-family: 'Courier New', 'Nimbus Mono PS', monospace; width: 80mm; margin: 0 auto; color: #000; font-size: 12px; }
  pre { white-space: pre-wrap; margin: 0; }
  .barcode { text-align: center; margin: 6px 0; }
  .barcode svg { max-width: 100%; }
  .footer { text-align: center; font-size: 12px; margin-top: 6px; }
</style>
</head>
<body>
<pre>${lines.join("\n")}</pre>
<div class="barcode">${barcodeSvg}</div>
<div class="footer">Terima kasih<br/>Sampai jumpa kembali</div>
</body>
</html>`
}

function StrukSheet({
  tx,
  settings,
  onPrint,
  onShare,
  onCopyLink,
  onBluetooth,
  bluetoothSupported,
  bluetoothBusy,
}: {
  tx: Transaction
  settings: Record<string, string>
  onPrint: () => void
  onShare: () => void
  onCopyLink: () => void
  onBluetooth: () => void
  bluetoothSupported: boolean
  bluetoothBusy: boolean
}) {
  return (
    <DrawerContent className="rounded-t-xl">
      <div className="flex min-h-0 flex-1 flex-col">
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-hairline text-left">
          <DrawerTitle className="text-lg font-bold">Struk</DrawerTitle>
          <DrawerClose className="rounded-full p-1.5 -mr-1.5 text-ink-muted active:bg-canvas-soft">
            <X className="size-5" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-[280px] rounded-xl bg-canvas border border-hairline p-5 text-center">
            <div className="font-mono text-ink space-y-0.5">
              <p className="font-bold text-sm">{settings.store_name || "Toko Saya"}</p>
              {settings.store_address && (
                <p className="text-xs text-ink-muted">{settings.store_address}</p>
              )}
              {settings.store_phone && <p className="text-xs text-ink-muted">{settings.store_phone}</p>}

              <div className="my-3 border-t border-dashed border-hairline" />
              <p className="text-xs font-semibold tracking-wide">NOTA PENJUALAN</p>
              <div className="my-3 border-t border-dashed border-hairline" />

              <p className="text-xs text-ink-muted">{formatDate(new Date(tx.created_at))}</p>
              <p className="text-xs text-ink-muted mb-1">No. {notaNo(tx)}</p>
              {buyerName(tx) && <p className="text-xs text-ink-muted">Pembeli: {buyerName(tx)}</p>}

              <div className="my-3 border-t border-dashed border-hairline" />

              <div className="space-y-1.5 text-left">
                {(tx.transaction_items as TxItem[]).map((item) => (
                  <div key={item.id}>
                    <p className="text-xs text-ink">
                      {item.qty} x {item.products?.name ?? "Produk dihapus"}
                    </p>
                    <p className="text-xs text-ink-muted text-right">
                      {fmtRp(item.subtotal - (item.discount ?? 0))}
                    </p>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-hairline" />

              {(() => {
                const itemDisc = (tx.transaction_items as TxItem[]).reduce(
                  (s, it) => s + (it.discount ?? 0),
                  0
                )
                const notaDisc = discountOf(tx)
                if (itemDisc === 0 && notaDisc === 0) return null
                return (
                  <>
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>Subtotal</span>
                      <span>{fmtRp(tx.total + itemDisc + notaDisc)}</span>
                    </div>
                    {itemDisc > 0 && (
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>Diskon Barang</span>
                        <span>-{fmtRp(itemDisc)}</span>
                      </div>
                    )}
                    {notaDisc > 0 && (
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>Diskon</span>
                        <span>-{fmtRp(notaDisc)}</span>
                      </div>
                    )}
                  </>
                )
              })()}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Total</span>
                <span className="text-sm font-bold">{fmtRp(tx.total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Pembayaran</span>
                <span>{methodLabel[tx.payment_method] ?? tx.payment_method}</span>
              </div>

              <div className="my-3 border-t border-dashed border-hairline" />
              <div className="flex justify-center">
                <Barcode value={notaNo(tx)} format="CODE128" height={40} fontSize={10} />
              </div>
              <div className="my-3 border-t border-dashed border-hairline" />
              <p className="text-xs text-ink-muted">Terima kasih</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-hairline p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="w-full rounded-full gap-1.5"
            onClick={onCopyLink}
          >
            <Copy className="size-4" />
            Salin Link Struk
          </Button>
          {bluetoothSupported && (
            <Button
              variant="outline"
              className="w-full rounded-full gap-1.5"
              onClick={onBluetooth}
              disabled={bluetoothBusy}
            >
              <Printer className="size-4" />
              {bluetoothBusy ? "Menghubungkan..." : "Cetak ke Printer Bluetooth"}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full gap-1.5" onClick={onShare}>
              <Share className="size-4" />
              Bagikan
            </Button>
            <Button className="flex-1 rounded-full gap-1.5" onClick={onPrint}>
              <Printer className="size-4" />
              Cetak
            </Button>
          </div>
        </div>
      </div>
    </DrawerContent>
  )
}

export function TransactionDetail({ id }: { id: string }) {
  const [tx, setTx] = useState<Transaction | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [payments, setPayments] = useState<BxPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStruk, setShowStruk] = useState(false)

  const [showPay, setShowPay] = useState(false)
  const [payInput, setPayInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [btSupported] = useState(() => isBluetoothPrintSupported())
  const [btBusy, setBtBusy] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
    getTransaction(id).then(({ transaction, error }) => {
      setTx(transaction)
      setError(error)
      setLoading(false)
    })
    getPayments(id).then(setPayments)
  }, [id])

  const remaining = tx ? Math.max(0, tx.total - paidOf(tx)) : 0
  const payAmount = Number(payInput.replace(/[^\d]/g, "")) || 0

  function handlePayChange(value: string) {
    const digits = value.replace(/[^\d]/g, "")
    setPayInput(digits ? Number(digits).toLocaleString("id-ID") : "")
  }

  async function handleRecordPayment() {
    if (!tx || payAmount <= 0) return
    setSaving(true)
    const { error: err } = await recordPayment(tx.id, Math.min(payAmount, remaining))
    setSaving(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success("Pembayaran tercatat")
    setShowPay(false)
    setPayInput("")
    // Muat ulang data terkini.
    getTransaction(id).then(({ transaction }) => setTx(transaction))
    getPayments(id).then(setPayments)
  }

  async function doBluetooth() {
    if (!tx) return
    setBtBusy(true)
    try {
      await printReceiptBluetooth(buildStrukLines(tx, settings))
      toast.success("Struk terkirim ke printer")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      // Pengguna membatalkan pemilihan perangkat — jangan tampilkan error.
      if (!/cancel|user|dibatalkan/i.test(msg)) {
        toast.error(msg || "Gagal mencetak via Bluetooth")
      }
    } finally {
      setBtBusy(false)
    }
  }

  function doPrint() {
    if (!tx) return
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.setAttribute("aria-hidden", "true")
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    if (!doc) {
      iframe.remove()
      return
    }
    const barcodeSvg = barcodeSvgString(notaNo(tx), "CODE128", { height: 40, fontSize: 10 })
    doc.open()
    doc.write(buildStrukHtml(tx, settings, barcodeSvg))
    doc.close()
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }

  async function doShare() {
    if (!tx) return
    const text = `${settings.store_name || "Toko Saya"}
${settings.store_address || ""}${settings.store_phone ? `\n${settings.store_phone}` : ""}
================
NOTA PENJUALAN
${formatDate(new Date(tx.created_at))}
No. ${notaNo(tx)}
${buyerName(tx) ? `Pembeli: ${buyerName(tx)}\n` : ""}----------------
${(tx.transaction_items as TxItem[])
  .map(
    (item) =>
      `${item.qty} x ${item.products?.name ?? "Produk dihapus"} = ${fmtRp(item.subtotal - (item.discount ?? 0))}`
  )
  .join("\n")}
----------------
${(() => {
  const itemDisc = (tx.transaction_items as TxItem[]).reduce(
    (s, it) => s + (it.discount ?? 0),
    0
  )
  const notaDisc = discountOf(tx)
  if (itemDisc === 0 && notaDisc === 0) return ""
  return `Subtotal: ${fmtRp(tx.total + itemDisc + notaDisc)}\n${
    itemDisc > 0 ? `Diskon Barang: -${fmtRp(itemDisc)}\n` : ""
  }${notaDisc > 0 ? `Diskon: -${fmtRp(notaDisc)}\n` : ""}`
})()}Total: ${fmtRp(tx.total)}
Bayar: ${methodLabel[tx.payment_method] ?? tx.payment_method}
================
Terima kasih`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Struk Transaksi", text })
      } catch {
        // user cancelled
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Struk disalin")
    } catch {
      toast.error("Gagal menyalin struk")
    }
  }

  async function doCopyLink() {
    if (!tx) return
    const token = (tx as Transaction & { share_token?: string }).share_token
    if (!token) {
      toast.error("Link struk belum tersedia")
      return
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`)
      toast.success("Link struk disalin")
    } catch {
      toast.error("Gagal menyalin link")
    }
  }

  const items = (tx?.transaction_items as TxItem[] | undefined) ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-hairline bg-canvas p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="mt-3 space-y-2.5 border-t border-hairline pt-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t border-hairline px-4 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <Skeleton className="mt-1.5 h-3 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ) : error || !tx ? (
          <p className="text-destructive text-sm">{error ?? "Transaksi tidak ditemukan"}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-canvas border border-hairline p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Total</span>
                <span className="text-lg font-bold text-ink">{fmtRp(tx.total)}</span>
              </div>
              <div className="mt-3 space-y-2 border-t border-hairline pt-3 text-sm">
                {(() => {
                  const itemDisc = items.reduce((s, it) => s + (it.discount ?? 0), 0)
                  const notaDisc = discountOf(tx)
                  if (itemDisc === 0 && notaDisc === 0) return null
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-ink-muted">Subtotal</span>
                        <span className="font-medium text-ink">
                          {fmtRp(tx.total + itemDisc + notaDisc)}
                        </span>
                      </div>
                      {itemDisc > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">Diskon Barang</span>
                          <span className="font-medium text-accent-green">
                            -{fmtRp(itemDisc)}
                          </span>
                        </div>
                      )}
                      {notaDisc > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">Diskon</span>
                          <span className="font-medium text-accent-green">
                            -{fmtRp(notaDisc)}
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Pembayaran</span>
                  <span className="font-medium text-ink capitalize">
                    {methodLabel[tx.payment_method] ?? tx.payment_method}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Status</span>
                  <span
                    className={
                      statusOf(tx) === "utang"
                        ? "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                        : "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                    }
                  >
                    {statusOf(tx) === "utang" ? "Belum Lunas" : "Lunas"}
                  </span>
                </div>
                {statusOf(tx) === "utang" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">Sudah Dibayar</span>
                      <span className="font-medium text-ink">{fmtRp(paidOf(tx))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">Sisa Utang</span>
                      <span className="font-semibold text-destructive">{fmtRp(remaining)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Tanggal</span>
                  <span className="font-medium text-ink">
                    {formatDate(new Date(tx.created_at))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Nomor Nota</span>
                  <span className="font-mono text-sm font-medium text-ink">
                    {notaNo(tx)}
                  </span>
                </div>
                {buyerName(tx) && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Pembeli</span>
                    <span className="font-medium text-ink">{buyerName(tx)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-canvas border border-hairline">
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h2 className="text-sm font-semibold text-ink">Item</h2>
                <span className="text-xs text-ink-faint">{items.length} barang</span>
              </div>
              {items.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-ink-faint">Tidak ada item</p>
              ) : (
                <div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 border-t border-hairline px-4 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas-soft text-ink-muted">
                        <Receipt className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {item.products?.name ?? "Produk dihapus"}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {item.qty} × {fmtRp(item.subtotal / item.qty)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {(item.discount ?? 0) > 0 ? (
                          <>
                            <p className="text-xs text-ink-faint line-through">
                              {fmtRp(item.subtotal)}
                            </p>
                            <p className="text-sm font-semibold text-ink">
                              {fmtRp(item.subtotal - (item.discount ?? 0))}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-ink">{fmtRp(item.subtotal)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                <span className="text-sm font-medium text-ink-muted">Total</span>
                <span className="text-lg font-bold text-ink">{fmtRp(tx.total)}</span>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="rounded-xl bg-canvas border border-hairline">
                <div className="px-4 pt-3.5 pb-2">
                  <h2 className="text-sm font-semibold text-ink">Riwayat Pembayaran</h2>
                </div>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-t border-hairline px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {p.note || methodLabel[p.method] || p.method}
                      </p>
                      <p className="text-xs text-ink-faint">{formatDate(new Date(p.created_at))}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{fmtRp(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {tx && (
        <div className="flex gap-2 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {remaining > 0 ? (
            <>
              <Button
                variant="outline"
                className="flex-1 rounded-full gap-1.5"
                onClick={() => setShowStruk(true)}
              >
                <Receipt className="size-4" />
                Struk
              </Button>
              <Button
                className="flex-1 rounded-full gap-1.5"
                onClick={() => {
                  setPayInput("")
                  setShowPay(true)
                }}
              >
                Catat Pembayaran
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1 rounded-full gap-1.5"
                onClick={() => setShowStruk(true)}
              >
                <Share className="size-4" />
                Bagikan Struk
              </Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={() => setShowStruk(true)}>
                <Printer className="size-4" />
                Cetak Struk
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={showPay} onOpenChange={(o) => !saving && setShowPay(o)}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Catat Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas-soft p-3 text-sm">
              <span className="text-ink-muted">Sisa utang</span>
              <span className="font-semibold text-destructive">{fmtRp(remaining)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Nominal bayar"
                  value={payInput}
                  onChange={(e) => handlePayChange(e.target.value)}
                  className="text-base font-semibold"
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setPayInput(remaining.toLocaleString("id-ID"))}
              >
                Lunasi
              </Button>
            </div>
            <Button
              className="w-full rounded-full h-11"
              disabled={saving || payAmount <= 0}
              onClick={handleRecordPayment}
            >
              {saving ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Drawer open={showStruk} onOpenChange={(o) => !o && setShowStruk(false)} showSwipeHandle>
        {tx && (
          <StrukSheet
            tx={tx}
            settings={settings}
            onPrint={doPrint}
            onShare={doShare}
            onCopyLink={doCopyLink}
            onBluetooth={doBluetooth}
            bluetoothSupported={btSupported}
            bluetoothBusy={btBusy}
          />
        )}
      </Drawer>
    </div>
  )
}
