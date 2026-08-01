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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createTransaction } from "@/lib/actions/transactions"
import { createCustomer } from "@/lib/actions/customers"
import { getCustomers, getSettings, resolveDiscountAmount, type BxCustomer } from "@/lib/db/queries"
import { useCart, cartKey, priceOf } from "@/components/cart/cart-provider"
import {
  ChevronRight,
  Dollar,
  Qr,
  Wallet,
  Check,
  Copy,
  User,
  Search,
  Plus,
  Receipt,
} from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import {
  onQueuedTransactionsChange,
  queueOfflineTransaction,
  syncQueuedTransactions,
} from "@/lib/offline/transactions"

type PaymentMethod = "cash" | "qris" | "dana" | "utang"

const methods: { id: PaymentMethod; label: string; icon: typeof Dollar }[] = [
  { id: "cash", label: "Tunai", icon: Dollar },
  { id: "qris", label: "QRIS", icon: Qr },
  { id: "dana", label: "DANA", icon: Wallet },
  { id: "utang", label: "Utang", icon: Receipt },
]

const quickAmounts = [10000, 20000, 50000, 100000, 200000]

export function CheckoutView() {
  const { items, clearCart, total, discounts, customer, setCustomer } = useCart()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Transaksi sudah berhasil dibuat & sedang menuju halaman detail. Dipakai agar
  // setelah clearCart() checkout tidak me-render layar "keranjang kosong" dulu.
  const [done, setDone] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paid, setPaid] = useState("")
  const [discountInput, setDiscountInput] = useState("")
  const [discountType, setDiscountType] = useState<"rp" | "pct">("rp")
  const [feeInput, setFeeInput] = useState("")
  const [feeType, setFeeType] = useState<"rp" | "pct">("rp")
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, string>>({})
  const [payConfig, setPayConfig] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

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
    if (typeof window === "undefined") return

    const syncNow = () => {
      if (navigator.onLine) {
        syncQueuedTransactions().catch(() => {})
      }
    }

    syncNow()
    window.addEventListener("online", syncNow)
    const unsubscribe = onQueuedTransactionsChange(syncNow)

    return () => {
      window.removeEventListener("online", syncNow)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (custOpen) getCustomers().then(setCustomers)
  }, [custOpen])

  const paidAmount = Number(paid.replace(/[^\d]/g, "")) || 0
  const discountRaw = Number(discountInput.replace(/[^\d]/g, "")) || 0
  const feeRaw = Number(feeInput.replace(/[^\d]/g, "")) || 0

  // Diskon per baris item = diskon otomatis (promo) + diskon manual kasir,
  // dibatasi ≤ subtotal baris (anti nilai negatif). Kunci baris = produk+varian.
  const itemDiscTotals = items.map((i) => {
    const key = cartKey(i)
    const price = priceOf(i)
    const subtotal = price * i.qty
    const auto = resolveDiscountAmount(i.product.id, price, discounts) * i.qty
    const manual =
      Number(itemDiscounts[key]?.replace(/[^\d]/g, "") ?? "") || 0
    return { key, id: i.product.id, subtotal, disc: Math.min(auto + manual, subtotal), auto }
  })
  const itemDiscTotal = itemDiscTotals.reduce((s, x) => s + x.disc, 0)

  const netBeforeNota = Math.max(0, total - itemDiscTotal)
  const discountAmount =
    discountType === "pct"
      ? Math.round((netBeforeNota * Math.min(discountRaw, 100)) / 100)
      : Math.min(discountRaw, netBeforeNota)
  // Biaya layanan/pajak: % dihitung dari total setelah diskon nota.
  const feeBase = Math.max(0, netBeforeNota - discountAmount)
  const feeAmount =
    feeType === "pct"
      ? Math.round((feeBase * Math.min(feeRaw, 100)) / 100)
      : feeRaw
  const netTotal = Math.max(0, feeBase + feeAmount)
  const change = paidAmount - netTotal
  const qrisPayload = payConfig.qris_payload ?? ""
  const danaNumber = payConfig.dana_number ?? ""

  const quickOptions = useMemo(
    () =>
      [netTotal, ...quickAmounts]
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .filter((n) => n >= netTotal)
        .slice(0, 4),
    [netTotal]
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

  function handleItemDiscountChange(key: string, value: string) {
    const digits = value.replace(/[^\d]/g, "")
    setItemDiscounts((prev) => ({
      ...prev,
      [key]: digits ? Number(digits).toLocaleString("id-ID") : "",
    }))
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
    const payload = items.map((i) => {
      const price = priceOf(i)
      return {
        product_id: i.product.id,
        qty: i.qty,
        price_sell: price,
        subtotal: price * i.qty,
        discount: itemDiscTotals.find((x) => x.key === cartKey(i))?.disc ?? 0,
        variant_id: i.variant?.id ?? null,
        variant_name: i.variant?.name ?? null,
      }
    })
    const dp = method === "utang" ? Math.min(paidAmount, netTotal) : undefined

    const queueDraft = async () => {
      try {
        await queueOfflineTransaction({
          items: payload,
          payment_method: method,
          customer_id: customer?.id ?? null,
          paid_amount: dp,
          discount: discountAmount,
          fee: feeAmount,
          total: netTotal,
          itemCount: items.reduce((sum, item) => sum + item.qty, 0),
          customerName: customer?.name ?? null,
        })
        setDone(true)
        clearCart()
        toast.success("Transaksi disimpan offline")
        router.push("/transactions")
      } catch {
        setError("Gagal menyimpan transaksi offline")
      } finally {
        setLoading(false)
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueDraft()
      return
    }

    try {
      const { error: err, id } = await createTransaction(
        payload,
        method,
        customer?.id ?? null,
        dp,
        discountAmount,
        feeAmount
      )
      if (err) {
        setError(err)
        setLoading(false)
        return
      }
      setDone(true)
      clearCart()
      router.push(`/transactions/${id}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : ""
      if (/fetch|network|offline|failed to fetch/i.test(message)) {
        await queueDraft()
        return
      }
      setError(message || "Gagal memproses transaksi")
      setLoading(false)
    }
  }

  const canCheckout =
    method === "cash"
      ? paidAmount >= netTotal && paidAmount > 0
      : method === "qris"
        ? !!qrisPayload
        : method === "dana"
          ? !!danaNumber
          : !!customer?.id

  // Transaksi berhasil; jangan tampilkan layar kosong selama menunggu navigasi
  // ke halaman detail transaksi.
  if (done) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-ink-muted">Transaksi tersimpan</p>
          <p className="text-xs text-ink-faint">Membuka detail transaksi...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col">
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
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
                    onClick={() => setPaid(netTotal ? netTotal.toLocaleString("id-ID") : "")}
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
                      {n === netTotal ? "Uang Pas" : `Rp${n.toLocaleString("id-ID")}`}
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

            {method === "utang" &&
              (!customer?.id ? (
                <p className="text-sm text-ink-muted bg-canvas-soft border border-hairline rounded-xl p-3 text-center">
                  Pilih pembeli dulu di atas untuk mencatat utang.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="DP / uang muka (opsional)"
                        value={paid}
                        onChange={(e) => handlePaidChange(e.target.value)}
                        className="text-base font-semibold"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setPaid("")}
                    >
                      Tanpa DP
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Sisa utang</span>
                    <span className="font-semibold text-destructive">
                      Rp{Math.max(0, netTotal - paidAmount).toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              ))}
          </div>
        </div>

        <div className="rounded-xl bg-canvas border border-hairline">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Barang
            </p>
            <span className="text-xs text-ink-faint">{items.length} item</span>
          </div>
          <div className="divide-y divide-hairline">
            {items.map((i) => {
              const key = cartKey(i)
              const price = priceOf(i)
              const line = itemDiscTotals.find((x) => x.key === key)!
              const subtotal = price * i.qty
              const net = Math.max(0, subtotal - line.disc)
              return (
                <div key={key} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{i.product.name}</p>
                    {i.variant && (
                      <p className="text-xs text-ink-muted">Varian: {i.variant.name}</p>
                    )}
                    <p className="text-xs text-ink-muted">
                      {i.qty} × Rp{price.toLocaleString("id-ID")}
                    </p>
                    {line.auto > 0 && (
                      <span className="mt-0.5 inline-flex items-center rounded-full bg-accent-orange/10 px-1.5 py-px text-[10px] font-semibold text-accent-orange">
                        Promo -Rp{line.auto.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {line.disc > 0 && (
                      <p className="text-xs text-ink-faint line-through">
                        Rp{subtotal.toLocaleString("id-ID")}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-ink">Rp{net.toLocaleString("id-ID")}</p>
                  </div>
                  <div className="flex w-28 shrink-0 items-center rounded-lg border border-hairline bg-canvas-soft focus-within:border-primary">
                    <span className="pl-2 text-xs text-ink-faint">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Potongan ${i.product.name}`}
                      value={itemDiscounts[key] ?? ""}
                      onChange={(e) => handleItemDiscountChange(key, e.target.value)}
                      className="w-full min-w-0 bg-transparent px-1.5 py-1.5 text-right text-sm font-semibold text-ink outline-none placeholder:text-ink-faint"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl bg-canvas border border-hairline">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Diskon & Biaya Layanan
          </p>
          <div className="p-3 pt-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-hairline">
                {(["rp", "pct"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDiscountType(t)}
                    className={cn(
                      "px-3.5 py-2 text-sm font-medium transition-colors",
                      discountType === t
                        ? "bg-primary/10 text-primary"
                        : "bg-canvas-soft text-ink-muted"
                    )}
                  >
                    {t === "rp" ? "Rp" : "%"}
                  </button>
                ))}
              </div>
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={discountType === "pct" ? "0%" : "Potongan (Rp)"}
                  value={discountInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "")
                    setDiscountInput(
                      digits ? Number(digits).toLocaleString("id-ID") : ""
                    )
                  }}
                  className="text-base font-semibold"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-hairline">
                {(["rp", "pct"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFeeType(t)}
                    className={cn(
                      "px-3.5 py-2 text-sm font-medium transition-colors",
                      feeType === t
                        ? "bg-primary/10 text-primary"
                        : "bg-canvas-soft text-ink-muted"
                    )}
                  >
                    {t === "rp" ? "Rp" : "%"}
                  </button>
                ))}
              </div>
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={feeType === "pct" ? "0%" : "Biaya (Rp)"}
                  value={feeInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "")
                    setFeeInput(
                      digits ? Number(digits).toLocaleString("id-ID") : ""
                    )
                  }}
                  className="text-base font-semibold"
                />
              </div>
            </div>
            <p className="text-[11px] text-ink-faint">
              Biaya layanan/pajak persen dihitung dari total setelah diskon.
            </p>
            {(itemDiscTotal > 0 || discountAmount > 0 || feeAmount > 0) && (
              <>
                {itemDiscTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Diskon Barang</span>
                    <span className="font-semibold text-accent-green">
                      -Rp{itemDiscTotal.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Diskon</span>
                    <span className="font-semibold text-accent-green">
                      -Rp{discountAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
                {feeAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Biaya Layanan</span>
                    <span className="font-semibold text-ink">
                      +Rp{feeAmount.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-hairline bg-canvas p-4 space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-ink-muted text-sm pb-1">Total Bayar</span>
          <span className="flex flex-col items-end">
            {(itemDiscTotal > 0 || discountAmount > 0) && (
              <span className="text-sm text-ink-faint line-through">
                Rp{total.toLocaleString("id-ID")}
              </span>
            )}
            <span className="text-2xl font-bold tracking-tight text-ink">
              Rp{netTotal.toLocaleString("id-ID")}
            </span>
          </span>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={handleCheckout}
          disabled={loading || !canCheckout}
          className="w-full rounded-full h-12 text-base"
        >
          {loading ? "Memproses..." : method === "utang" ? "Simpan Utang" : "Bayar"}
        </Button>
      </div>

      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Pembeli</DialogTitle>
            <DialogDescription>
              Pilih pembeli atau lanjutkan sebagai pelanggan umum.
            </DialogDescription>
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
