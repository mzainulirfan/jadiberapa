"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getReports, type BxReports } from "@/lib/db/queries"
import { ChartLine, ChevronDown, ChevronRight, Printer, Share, Wallet } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type ReportsData = BxReports
type RangeKey = "today" | "week" | "month" | "all"

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "7 Hari" },
  { key: "month", label: "Bulan Ini" },
  { key: "all", label: "Semua" },
]

const PAYMENT_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS", dana: "DANA", utang: "Utang" }

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

function safeFileName(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-")
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Ekspor CSV — pemisah titik-koma + BOM UTF-8 agar Excel Indonesia mengenali kolom.
function exportCsv(data: BxReports, periodLabel: string) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows: (string | number)[][] = [
    ["Laporan", periodLabel],
    [],
    ["Ringkasan", "Nilai (Rp)"],
    ["Omzet", data.totalRevenue],
    ["Laba Kotor", data.profit],
    ["Pengeluaran", data.totalExpenses],
    ["Laba Bersih", data.netProfit],
    ["Jumlah Transaksi", data.count],
    ["Barang Terjual", data.totalItems],
    [],
    ["Metode Pembayaran", "Nilai (Rp)"],
    ...data.payment.map((p) => [PAYMENT_LABEL[p.key] ?? p.key, p.value]),
    [],
    ["Produk Terlaris", "Qty", "Total (Rp)"],
    ...data.topProducts.map((p) => [p.name, p.qty, p.total]),
  ]
  const csv = rows.map((r) => r.map(esc).join(";")).join("\r\n")
  downloadBlob(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    `laporan-${safeFileName(periodLabel)}.csv`
  )
}

function exportExcel(data: BxReports, periodLabel: string) {
  const rows: [string, string | number][] = [
    ["Omzet", data.totalRevenue],
    ["Laba Kotor", data.profit],
    ["Pengeluaran", data.totalExpenses],
    ["Laba Bersih", data.netProfit],
    ["Jumlah Transaksi", data.count],
    ["Barang Terjual", data.totalItems],
  ]
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /></head><body>
  <table>
    <tr><th colspan="2">Laporan ${escapeHtml(periodLabel)}</th></tr>
    ${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join("")}
  </table>
  <br />
  <table>
    <tr><th>Metode Pembayaran</th><th>Nilai</th></tr>
    ${data.payment.map((p) => `<tr><td>${escapeHtml(PAYMENT_LABEL[p.key] ?? p.key)}</td><td>${p.value}</td></tr>`).join("")}
  </table>
  <br />
  <table>
    <tr><th>Produk Terlaris</th><th>Qty</th><th>Total</th></tr>
    ${data.topProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${p.total}</td></tr>`).join("")}
  </table>
</body></html>`
  downloadBlob(
    new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `laporan-${safeFileName(periodLabel)}.xls`
  )
}

// Ekspor PDF — render HTML lalu picu print (dialog cetak browser bisa "Simpan PDF").
function exportPdf(data: BxReports, periodLabel: string, marginPct: string) {
  const paymentRows = data.payment
    .map(
      (p) =>
        `<tr><td>${escapeHtml(PAYMENT_LABEL[p.key] ?? p.key)}</td><td class="num">${fmtRp(p.value)}</td></tr>`
    )
    .join("")
  const topRows = data.topProducts
    .slice(0, 15)
    .map(
      (p, i) =>
        `<tr><td>${i + 1}. ${escapeHtml(p.name)}</td><td class="num">${p.qty}</td><td class="num">${fmtRp(p.total)}</td></tr>`
    )
    .join("")
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Laporan ${periodLabel}</title>
<style>
  @page { margin: 14mm; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1a1a1a; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .muted { color: #6b6b6b; font-size: 12px; margin: 0 0 16px; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 2px; text-align: left; border-bottom: 1px solid #f0f0f0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .big { font-size: 22px; font-weight: 700; margin: 4px 0 0; }
</style></head>
<body>
  <h1>Laporan Penjualan</h1>
  <p class="muted">Periode: ${periodLabel}</p>
  <p class="muted">Omzet</p>
  <p class="big">${fmtRp(data.totalRevenue)}</p>
  <h2>Ringkasan</h2>
  <table>
    <tr><td>Laba Kotor</td><td class="num">${fmtRp(data.profit)} (${marginPct})</td></tr>
    <tr><td>Pengeluaran</td><td class="num">${fmtRp(data.totalExpenses)}</td></tr>
    <tr><td>Laba Bersih</td><td class="num">${fmtRp(data.netProfit)}</td></tr>
    <tr><td>Jumlah Transaksi</td><td class="num">${data.count}</td></tr>
    <tr><td>Barang Terjual</td><td class="num">${data.totalItems}</td></tr>
  </table>
  ${paymentRows ? `<h2>Metode Pembayaran</h2><table>${paymentRows}</table>` : ""}
  ${topRows ? `<h2>Produk Terlaris</h2><table>${topRows}</table>` : ""}
</body></html>`
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
  doc.write(html)
  doc.close()
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => iframe.remove(), 1000)
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

// Ubah bucket tren dari RPC menjadi label siap-tampil sesuai periode.
// Data sudah teragregasi & dibatasi 14 titik terakhir (urut naik) di SQL.
function trendLabels(trend: { t: string; value: number }[], range: RangeKey) {
  return trend.map((b) => ({
    label:
      range === "today"
        ? `${b.t.padStart(2, "0")}.00`
        : new Date(`${b.t}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    value: b.value,
  }))
}

function buildShareText(data: BxReports, periodLabel: string, marginPct: string) {
  const lines = [
    `Laporan ${periodLabel}`,
    `Omzet: ${fmtRp(data.totalRevenue)}`,
    `Laba kotor: ${fmtRp(data.profit)} (${marginPct})`,
    `Pengeluaran: ${fmtRp(data.totalExpenses)}`,
    `Laba bersih: ${fmtRp(data.netProfit)}`,
    `Transaksi: ${data.count}`,
    `Barang terjual: ${data.totalItems}`,
  ]
  if (data.topProducts.length) {
    lines.push(`Terlaris: ${data.topProducts.slice(0, 3).map((p) => p.name).join(", ")}`)
  }
  return lines.join("\n")
}

export function ReportsView() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>("today")

  function changeRange(next: RangeKey) {
    setLoading(true)
    setRange(next)
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await getReports(fromForRange(range), range === "today" ? "hour" : "day")
      if (active) {
        setData(result)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [range])

  const periodLabel = RANGES.find((r) => r.key === range)?.label ?? ""
  const marginPct = data && data.totalRevenue > 0 ? `${Math.round((data.profit / data.totalRevenue) * 100)}%` : "–"
  const hasReportData = !!data && (data.count > 0 || data.totalExpenses > 0)

  async function share() {
    if (!data) return
    const text = buildShareText(data, periodLabel, marginPct)
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ text })
      } catch {
        /* dibatalkan pengguna */
      }
      return
    }
    await navigator.clipboard.writeText(text)
    toast.success("Ringkasan disalin")
  }

  function shareWhatsApp() {
    if (!data) return
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText(data, periodLabel, marginPct))}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <PeriodDropdown value={range} onChange={changeRange} />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={loading || !hasReportData}
              className="flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors outline-none active:bg-canvas-soft data-[popup-open]:bg-canvas-soft disabled:opacity-50"
            >
              <Printer className="size-3.5" /> Ekspor
              <ChevronDown className="size-3.5 text-ink-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => data && exportCsv(data, periodLabel)}>
                Unduh CSV (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data && exportExcel(data, periodLabel)}>
                Unduh Excel (.xls)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => data && exportPdf(data, periodLabel, marginPct)}>
                Cetak / PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={share}
            disabled={loading || !hasReportData}
            className="flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors active:bg-canvas-soft disabled:opacity-50"
          >
            <Share className="size-3.5" /> Bagikan
          </button>
          <button
            onClick={shareWhatsApp}
            disabled={loading || !hasReportData}
            className="hidden h-8 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors active:bg-canvas-soft disabled:opacity-50 sm:flex"
          >
            WhatsApp
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-hairline bg-canvas p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 w-32 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-44 rounded-md" />
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-2.5 w-14 rounded-full" />
                  <Skeleton className="mt-1.5 h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-hairline bg-canvas p-3.5">
                <Skeleton className="h-3 w-14 rounded-full" />
                <Skeleton className="mt-1.5 h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <Skeleton className="h-4 w-28 rounded-md" />
            <div className="mt-3 flex h-24 items-end gap-1">
              {[...Array(10)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${20 + ((i * 41) % 75)}%` }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <Skeleton className="h-4 w-36 rounded-md" />
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                  <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : data ? (
        <Content data={data} range={range} periodLabel={periodLabel} />
      ) : null}
    </div>
  )
}

function Content({
  data,
  range,
  periodLabel,
}: {
  data: ReportsData
  range: RangeKey
  periodLabel: string
}) {
  const avg = data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0
  const trend = trendLabels(data.trend, range)
  const trendMax = Math.max(1, ...trend.map((t) => t.value))
  const peak = trend.reduce((m, t) => (t.value > m ? t.value : m), 0)

  const payment = data.payment.map((p) => ({
    key: p.key,
    label: PAYMENT_LABEL[p.key] ?? p.key,
    value: p.value,
  }))

  const top = data.topProducts.slice(0, 8)
  const maxQty = Math.max(1, ...top.map((p) => p.qty))

  return (
    <>
      {/* Hero — kartu terang beraksen */}
      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-4" />
          </span>
          <p className="text-sm font-medium text-ink-muted">Pendapatan · {periodLabel}</p>
        </div>
        <p className="mt-3 text-[30px] font-bold leading-none tracking-tight text-ink">
          {fmtRp(data.totalRevenue)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
          <div>
            <p className="text-[11px] text-ink-faint">Laba Kotor</p>
            <p className="mt-0.5 truncate text-sm font-bold text-accent-green">{fmtRp(data.profit)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-faint">Pengeluaran</p>
            <p className="mt-0.5 truncate text-sm font-bold text-destructive">{fmtRp(data.totalExpenses)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-faint">Laba Bersih</p>
            <p className={cn("mt-0.5 truncate text-sm font-bold", data.netProfit < 0 ? "text-destructive" : "text-ink")}>
              {fmtRp(data.netProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Statistik sekunder */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Transaksi" value={String(data.count)} />
        <StatCard label="Barang Terjual" value={String(data.totalItems)} />
        <StatCard label="Rata-rata/Transaksi" value={fmtRp(avg)} />
      </div>

      {data.count === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">Belum ada transaksi pada periode ini</p>
      ) : (
        <>
          {/* Tren omzet */}
          {trend.length > 0 && (
            <div className="rounded-xl border border-hairline bg-canvas p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Tren Omzet</h2>
                <span className="text-xs text-ink-faint">Puncak {fmtRp(peak)}</span>
              </div>
              <div className="flex h-24 items-end gap-1">
                {trend.map((b, i) => (
                  <div
                    key={i}
                    className={cn("flex-1 rounded-sm", b.value === peak ? "bg-primary" : "bg-primary/25")}
                    style={{ height: `${Math.max((b.value / trendMax) * 100, 3)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
                <span>{trend[0].label}</span>
                <span>{trend[trend.length - 1].label}</span>
              </div>
            </div>
          )}

          {/* Metode pembayaran */}
          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <h2 className="mb-3 text-sm font-semibold text-ink">Metode Pembayaran</h2>
            <div className="space-y-2.5">
              {payment.map((p) => {
                const pct = data.totalRevenue > 0 ? (p.value / data.totalRevenue) * 100 : 0
                return (
                  <div key={p.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">{p.label}</span>
                      <span className="font-medium text-ink">
                        {fmtRp(p.value)} · {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas-soft">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Produk terlaris */}
          <div className="rounded-xl border border-hairline bg-canvas p-3">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ChartLine className="size-4 text-primary" /> Produk Terlaris
            </h2>
            {top.length === 0 ? (
              <p className="text-xs text-ink-faint">Belum ada data</p>
            ) : (
              <div className="space-y-2.5">
                {top.map((p, i) => (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate text-ink-muted">
                        {i + 1}. {p.name}
                      </span>
                      <span className="shrink-0 font-medium text-ink">
                        {p.qty} terjual · {fmtRp(p.total)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas-soft">
                      <div
                        className="h-full rounded-full bg-accent-teal"
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/transactions"
            className="flex items-center justify-center gap-1 rounded-xl border border-hairline bg-canvas p-3 text-sm font-medium text-ink-muted transition-colors active:bg-canvas-soft"
          >
            Lihat semua transaksi <ChevronRight className="size-4" />
          </Link>
        </>
      )}
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-3">
      <p className="truncate text-[11px] text-ink-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
