"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { getTransaction } from "@/lib/actions/transactions"
import { getSettings } from "@/lib/actions/settings"
import { ChevronLeft, Printer, Share, X, Receipt } from "@/components/ui/icons"

type Transaction = NonNullable<Awaited<ReturnType<typeof getTransaction>>["transaction"]>
type TxItem = {
  id: string
  qty: number
  subtotal: number
  products?: { name?: string } | null
}

const methodLabel: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  dana: "DANA",
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

function buildStrukHtml(tx: Transaction, settings: Record<string, string>) {
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
  lines.push(`No  : ${tx.id.slice(0, 8).toUpperCase()}`)
  lines.push(`Tgl : ${dateStr} ${timeStr}`)
  lines.push(sep)
  for (const item of tx.transaction_items as TxItem[]) {
    lines.push(`${item.qty} x ${item.products?.name ?? "Produk dihapus"}`)
    lines.push(right(fmtRp(item.subtotal)))
  }
  lines.push(sep)
  lines.push(`Total${right(fmtRp(tx.total))}`)
  lines.push(`Bayar: ${methodLabel[tx.payment_method] ?? tx.payment_method}`)
  lines.push(sep)
  lines.push(center("Terima kasih"))
  lines.push(center("Sampai jumpa kembali"))

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Struk</title>
<style>
  @page { margin: 8mm; }
  body { font-family: 'Courier New', 'Nimbus Mono PS', monospace; width: 80mm; margin: 0 auto; color: #000; font-size: 12px; }
  pre { white-space: pre-wrap; }
</style>
</head>
<body>
<pre>${lines.join("\n")}</pre>
</body>
</html>`
}

function StrukSheet({
  tx,
  settings,
  onPrint,
  onShare,
}: {
  tx: Transaction
  settings: Record<string, string>
  onPrint: () => void
  onShare: () => void
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
              <p className="text-xs text-ink-muted mb-1">No. {tx.id.slice(0, 8).toUpperCase()}</p>

              <div className="my-3 border-t border-dashed border-hairline" />

              <div className="space-y-1.5 text-left">
                {(tx.transaction_items as TxItem[]).map((item) => (
                  <div key={item.id}>
                    <p className="text-xs text-ink">
                      {item.qty} x {item.products?.name ?? "Produk dihapus"}
                    </p>
                    <p className="text-xs text-ink-muted text-right">{fmtRp(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-hairline" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Total</span>
                <span className="text-sm font-bold">{fmtRp(tx.total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Pembayaran</span>
                <span>{methodLabel[tx.payment_method] ?? tx.payment_method}</span>
              </div>

              <div className="my-3 border-t border-dashed border-hairline" />
              <p className="text-xs text-ink-muted">Terima kasih</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-hairline p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
    </DrawerContent>
  )
}

export function TransactionDetail({ id }: { id: string }) {
  const [tx, setTx] = useState<Transaction | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStruk, setShowStruk] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
    getTransaction(id).then(({ transaction, error }) => {
      setTx(transaction)
      setError(error)
      setLoading(false)
    })
  }, [id])

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
    doc.open()
    doc.write(buildStrukHtml(tx, settings))
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
No. ${tx.id.slice(0, 8).toUpperCase()}
----------------
${(tx.transaction_items as TxItem[])
  .map((item) => `${item.qty} x ${item.products?.name ?? "Produk dihapus"} = ${fmtRp(item.subtotal)}`)
  .join("\n")}
----------------
Total: ${fmtRp(tx.total)}
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

  const items = (tx?.transaction_items as TxItem[] | undefined) ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-4 pb-3">
        <Link href="/transactions" className="rounded-full p-1.5 -ml-1.5 text-ink-muted">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
          Detail Transaksi
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : error || !tx ? (
          <p className="text-destructive text-sm">{error ?? "Transaksi tidak ditemukan"}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-ink text-white p-4">
              <p className="text-sm font-medium text-white/60">Total Pembayaran</p>
              <p className="text-[30px] font-bold tracking-tight text-white mt-1">
                {fmtRp(tx.total)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-white">
                  {methodLabel[tx.payment_method] ?? tx.payment_method}
                </span>
                <span className="text-xs text-white/60">{formatDate(new Date(tx.created_at))}</span>
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
                        <p className="text-xs text-ink-muted">{item.qty} × {fmtRp(item.subtotal / item.qty)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-ink">
                        {fmtRp(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                <span className="text-sm font-medium text-ink-muted">Total</span>
                <span className="text-lg font-bold text-ink">{fmtRp(tx.total)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-canvas border border-hairline p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Nomor Nota</span>
                <span className="font-mono text-sm font-medium text-ink">
                  {tx.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {tx && (
        <div className="flex gap-2 border-t border-hairline bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
        </div>
      )}

      <Drawer open={showStruk} onOpenChange={(o) => !o && setShowStruk(false)} showSwipeHandle>
        {tx && (
          <StrukSheet
            tx={tx}
            settings={settings}
            onPrint={doPrint}
            onShare={doShare}
          />
        )}
      </Drawer>
    </div>
  )
}
