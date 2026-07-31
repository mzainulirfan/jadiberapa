"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createTransaction } from "@/lib/actions/transactions"
import { getSettings } from "@/lib/actions/settings"
import { createCustomer } from "@/lib/actions/customers"
import { getCustomers, type BxCustomer } from "@/lib/db/queries"
import { useCart } from "@/components/cart/cart-provider"
import {
  ChevronLeft,
  ChevronRight,
  Dollar,
  Qr,
  Wallet,
  Check,
  Copy,
  User,
  Search,
  Plus,
} from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type PaymentMethod = "cash" | "qris" | "dana"

const methods: { id: PaymentMethod; label: string; icon: typeof Dollar }[] = [
  { id: "cash", label: "Tunai", icon: Dollar },
  { id: "qris", label: "QRIS", icon: Qr },
  { id: "dana", label: "DANA", icon: Wallet },
]

const quickAmounts = [10000, 20000, 50000, 100000, 200000]

export function CheckoutView() {
  const { items, clearCart, total, count } = useCart()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paid, setPaid] = useState("")
  const [payConfig, setPayConfig] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const [customer, setCustomer] = useState<{ id: string | null; name: string } | null>(null)
  const [custOpen, setCustOpen] = useState(false)
  const [custSearch, setCustSearch] = useState("")
  const [customers, setCustomers] = useState<BxCustomer[]>([])
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getSettings().then(setPayConfig)
  }, [])

  useEffect(() => {
    if (custOpen) getCustomers().then(setCustomers)
  }, [custOpen])

  const paidAmount = Number(paid.replace(/[^\d]/g, "")) || 0
  const change = paidAmount - total
  const qrisPayload = payConfig.qris_payload ?? ""
  const danaNumber = payConfig.dana_number ?? ""

  const quickOptions = useMemo(
    () =>
      [total, ...quickAmounts]
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .filter((n) => n >= total)
        .slice(0, 4),
    [total]
  )

  const filteredCustomers = useMemo(() => {
    const s = custSearch.trim().toLowerCase()
    if (!s) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(s))
  }, [customers, custSearch])

  function handlePaidChange(value: string) {
    const digits = value.replace(/[^\d]/g, "")
    setPaid(digits ? Number(digits).toLocaleString("id-ID") : "")
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(danaNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleCreateCustomer() {
    if (!newName.trim()) return
    setCreating(true)
    const fd = new FormData()
    fd.set("name", newName.trim())
    if (newPhone.trim()) fd.set("phone", newPhone.trim())
    const { error: err, id } = await createCustomer(fd)
    setCreating(false)
    if (err || !id) {
      toast.error(err ?? "Gagal menyimpan pembeli")
      return
    }
    setCustomer({ id, name: newName.trim() })
    setNewName("")
    setNewPhone("")
    setCustOpen(false)
    getCustomers().then(setCustomers)
  }

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    const payload = items.map((i) => ({
      product_id: i.product.id,
      qty: i.qty,
      price_sell: i.product.price_sell,
      subtotal: i.product.price_sell * i.qty,
    }))
    const { error: err, id } = await createTransaction(payload, method, customer?.id ?? null)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    clearCart()
    router.push(`/transactions/${id}`)
  }

  const canCheckout =
    method === "cash"
      ? paidAmount >= total && paidAmount > 0
      : method === "qris"
        ? !!qrisPayload
        : !!danaNumber

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 p-4 pb-3">
          <Link href="/cart" className="rounded-full p-1.5 -ml-1.5 text-ink-muted">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
            Pembayaran
          </h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
          <p className="text-ink-faint text-sm">Keranjang kosong, tidak ada yang dibayar</p>
          <Button variant="outline" onClick={() => router.push("/cashier")}>
            Tambah Barang
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-4 pb-3">
        <Link href="/cart" className="rounded-full p-1.5 -ml-1.5 text-ink-muted">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink">
          Pembayaran
        </h1>
        <span className="text-ink-faint text-sm">({count} item)</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-0 pb-4 space-y-4">
        <div className="rounded-xl bg-canvas border border-hairline">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Pembeli
          </p>
          <div className="p-3 pt-0">
            <button
              type="button"
              onClick={() => setCustOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-canvas-soft p-3 text-left"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-ink truncate">
                  {customer ? customer.name : "Umum (tanpa pembeli)"}
                </span>
                {customer && (
                  <span className="block text-xs text-ink-muted">Pembeli terpilih</span>
                )}
              </span>
              <ChevronRight className="size-4 text-ink-faint" />
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-canvas border border-hairline">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Metode Pembayaran
          </p>
          <div className="p-3 pt-0 space-y-3">
            <div className="flex gap-2">
              {methods.map((m) => {
                const Icon = m.icon
                const selected = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-ink"
                        : "border-hairline bg-canvas-soft text-ink-muted"
                    )}
                  >
                    <Icon className={cn("size-4", selected ? "text-primary" : "text-ink-faint")} />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {method === "cash" && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Uang diterima"
                      value={paid}
                      onChange={(e) => handlePaidChange(e.target.value)}
                      className="text-base font-semibold"
                      autoFocus
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPaid(total ? total.toLocaleString("id-ID") : "")}
                  >
                    Uang Pas
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPaid(n.toLocaleString("id-ID"))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        paidAmount === n
                          ? "border-primary bg-primary/10 text-ink"
                          : "border-hairline bg-canvas-soft text-ink-muted"
                      )}
                    >
                      {n === total ? "Uang Pas" : `Rp${n.toLocaleString("id-ID")}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{change < 0 ? "Kurang" : "Kembalian"}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      change < 0 ? "text-destructive" : "text-primary"
                    )}
                  >
                    Rp{Math.abs(change).toLocaleString()}
                  </span>
                </div>
              </>
            )}

            {method === "qris" &&
              (qrisPayload ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-canvas-soft p-4">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCodeSVG value={qrisPayload} size={200} marginSize={0} />
                  </div>
                  <p className="text-xs text-ink-muted text-center">
                    Minta pelanggan scan QRIS ini untuk membayar
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted bg-canvas-soft border border-hairline rounded-xl p-3 text-center">
                  Kode QRIS belum diatur. Tambahkan di{" "}
                  <Link href="/settings" className="text-primary font-medium underline">
                    Pengaturan
                  </Link>
                  .
                </p>
              ))}

            {method === "dana" &&
              (danaNumber ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas-soft p-4">
                  <div>
                    <p className="text-xs text-ink-muted mb-0.5">Nomor DANA</p>
                    <p className="text-lg font-semibold text-ink">{danaNumber}</p>
                  </div>
                  <Button variant="outline" className="rounded-full gap-1.5" onClick={handleCopy}>
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                    {copied ? "Tersalin" : "Salin"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-ink-muted bg-canvas-soft border border-hairline rounded-xl p-3 text-center">
                  Nomor DANA belum diatur. Tambahkan di{" "}
                  <Link href="/settings" className="text-primary font-medium underline">
                    Pengaturan
                  </Link>
                  .
                </p>
              ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-hairline bg-canvas p-4 space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-ink-muted text-sm pb-1">Total Bayar</span>
          <span className="text-2xl font-bold tracking-tight text-ink">
            Rp{total.toLocaleString()}
          </span>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={handleCheckout}
          disabled={loading || !canCheckout}
          className="w-full rounded-full h-12 text-base"
        >
          {loading ? "Memproses..." : "Bayar"}
        </Button>
      </div>

      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Pilih Pembeli</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
              <Input
                placeholder="Cari pembeli..."
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setCustomer(null)
                setCustOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border p-3 text-left",
                !customer ? "border-primary bg-primary/5" : "border-hairline bg-canvas"
              )}
            >
              <User className="size-4 text-ink-muted" />
              <span className="flex-1 text-sm font-medium text-ink">Umum (tanpa pembeli)</span>
              {!customer && <Check className="size-4 text-primary" />}
            </button>

            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCustomer({ id: c.id, name: c.name })
                  setCustOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border p-3 text-left",
                  customer?.id === c.id ? "border-primary bg-primary/5" : "border-hairline bg-canvas"
                )}
              >
                <User className="size-4 text-ink-muted" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{c.name}</span>
                  {c.phone && <span className="block text-xs text-ink-muted">{c.phone}</span>}
                </span>
                {customer?.id === c.id && <Check className="size-4 text-primary" />}
              </button>
            ))}

            <div className="space-y-2 rounded-xl border border-dashed border-hairline p-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Tambah Pembeli Baru
              </p>
              <Input
                placeholder="Nama"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="Telepon (opsional)"
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <Button
                className="w-full rounded-full gap-1.5"
                onClick={handleCreateCustomer}
                disabled={creating || !newName.trim()}
              >
                {creating ? (
                  "Menyimpan..."
                ) : (
                  <>
                    <Plus className="size-4" />
                    Tambah & Pilih
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
