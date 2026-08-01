import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { PrintButton } from "@/components/public-receipt/print-button"

export const dynamic = "force-dynamic"

type PublicReceipt = {
  store: { name: string; address: string; phone: string }
  number: string | null
  created_at: string
  payment_method: string
  total: number
  discount: number
  paid_amount: number
  status: string
  customer: { name: string } | null
  items: { name: string; qty: number; price_sell: number; subtotal: number; discount: number }[]
  payments: { amount: number; method: string; created_at: string }[]
}

const methodLabel: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  dana: "DANA",
  utang: "Utang",
}

const fmtRp = (n: number) => `Rp${n.toLocaleString("id-ID")}`

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function formatDate(s: string) {
  const d = new Date(s)
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!UUID_RE.test(token)) notFound()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase.rpc("get_public_receipt", { p_token: token })
  const r = data as unknown as PublicReceipt | null
  if (!r) notFound()

  const storeName = r.store.name || "Toko Saya"
  const itemDisc = r.items.reduce((s, it) => s + (it.discount ?? 0), 0)
  const notaDisc = r.discount || 0
  const isUtang = r.status === "utang"

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas-soft px-4 py-8 print:py-0 print:bg-white">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="font-mono text-ink space-y-0.5">
            <p className="text-center font-bold">{storeName}</p>
            {r.store.address && (
              <p className="text-center text-xs text-ink-muted">{r.store.address}</p>
            )}
            {r.store.phone && <p className="text-center text-xs text-ink-muted">{r.store.phone}</p>}

            <div className="my-3 border-t border-dashed border-hairline" />
            <p className="text-center text-xs font-semibold tracking-wide">NOTA PENJUALAN</p>
            <div className="my-3 border-t border-dashed border-hairline" />

            <p className="text-xs text-ink-muted text-center">{formatDate(r.created_at)}</p>
            <p className="text-xs text-ink-muted text-center mb-1">
              No. {r.number ?? token.slice(0, 8).toUpperCase()}
            </p>
            {r.customer && (
              <p className="text-xs text-ink-muted text-center">Pembeli: {r.customer.name}</p>
            )}

            <div className="my-3 border-t border-dashed border-hairline" />

            <div className="space-y-1.5">
              {r.items.map((it, i) => (
                <div key={i}>
                  <p className="text-xs">{it.qty} x {it.name}</p>
                  <p className="text-xs text-ink-muted text-right">
                    {fmtRp(it.subtotal - (it.discount ?? 0))}
                  </p>
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-hairline" />

            {(itemDisc > 0 || notaDisc > 0) && (
              <>
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>Subtotal</span>
                  <span>{fmtRp(r.total + itemDisc + notaDisc)}</span>
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
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Total</span>
              <span className="text-sm font-bold">{fmtRp(r.total)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Pembayaran</span>
              <span>{methodLabel[r.payment_method] ?? r.payment_method}</span>
            </div>
            {isUtang && (
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Status</span>
                <span>Belum Lunas</span>
              </div>
            )}

            <div className="my-3 border-t border-dashed border-hairline" />
            <p className="text-center text-xs text-ink-muted">Terima kasih</p>
            <p className="mt-2 text-center text-[10px] text-ink-faint">
              Dibuat dengan Saberaha
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-center print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  )
}
