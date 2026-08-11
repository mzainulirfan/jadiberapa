"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resolveDiscountAmount } from "@/lib/db/queries"
import { priceOf, useCart } from "@/components/cart/cart-provider"
import { CartItems } from "@/components/cart/cart-items"
import {
  getHeldCarts,
  getHeldCart,
  saveHeldCart,
  deleteHeldCart,
  type HeldCart,
} from "@/lib/db/held-carts"
import { Package, ChevronRight, ChevronDown, Trash } from "@/components/ui/icons"

const heldDateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function CartView() {
  const { items, clearCart, replaceCart, netTotal, discounts, count, customer, setCustomer } =
    useCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const router = useRouter()

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [heldOpen, setHeldOpen] = useState(false)
  const [expandedHeld, setExpandedHeld] = useState<string | null>(null)
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdLabel, setHoldLabel] = useState("")
  const [holding, setHolding] = useState(false)
  const [resumeTarget, setResumeTarget] = useState<HeldCart | null>(null)
  const [resuming, setResuming] = useState(false)

  const loadHeld = useCallback(() => {
    getHeldCarts().then(setHeldCarts)
  }, [])

  useEffect(() => {
    loadHeld()
  }, [loadHeld])

  function handleClear() {
    clearCart()
    setConfirmClear(false)
    toast.success("Keranjang dikosongkan")
  }

  async function handleHold() {
    if (items.length === 0) return
    setHolding(true)
    // Kalau label kosong, pakai nama pembeli terpilih; kalau tidak ada, "Pesanan N".
    const label = holdLabel.trim() || customer?.name || `Pesanan ${heldCarts.length + 1}`
    const id = await saveHeldCart(label, items, customer)
    setHolding(false)
    if (!id) {
      toast.error("Gagal menahan pesanan")
      return
    }
    setHoldOpen(false)
    setHoldLabel("")
    clearCart()
    loadHeld()
    toast.success(`Pesanan "${label}" ditahan`)
  }

  async function handleResume(h: HeldCart) {
    setHeldOpen(false)
    const held = await getHeldCart(h.id)
    if (!held || held.items.length === 0) {
      toast.error("Pesanan sudah tidak tersedia")
      loadHeld()
      return
    }
    // Kalau keranjang aktif masih berisi, minta konfirmasi dulu (akan diganti).
    if (items.length > 0) {
      setResumeTarget(h)
      return
    }
    replaceCart(held.items)
    setCustomer(held.customer)
    await deleteHeldCart(h.id)
    loadHeld()
    toast.success(`Pesanan "${h.label}" dilanjutkan`)
  }

  async function handleConfirmResume() {
    if (!resumeTarget) return
    setResuming(true)
    const held = await getHeldCart(resumeTarget.id)
    if (!held || held.items.length === 0) {
      toast.error("Pesanan sudah tidak tersedia")
      setResuming(false)
      setResumeTarget(null)
      loadHeld()
      return
    }
    replaceCart(held.items)
    setCustomer(held.customer)
    await deleteHeldCart(resumeTarget.id)
    setResuming(false)
    setResumeTarget(null)
    loadHeld()
    toast.success(`Pesanan "${resumeTarget.label}" dilanjutkan`)
  }

  async function handleDeleteHeld(h: HeldCart) {
    await deleteHeldCart(h.id)
    loadHeld()
    toast.success("Pesanan ditahan dihapus")
  }

  return (
    <div className="flex h-full flex-col">
      {heldCarts.length > 0 && (
        <div className="p-4 pb-0">
          <button
            type="button"
            onClick={() => setHeldOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-hairline bg-canvas p-3 text-left transition-colors active:bg-canvas-soft"
          >
            <Package className="size-4 shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Pesanan Ditahan</p>
              <p className="text-xs text-ink-faint">{heldCarts.length} pesanan menunggu dilanjutkan</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between p-4 pb-2">
          <span className="text-sm text-ink-muted">{count} item</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHoldOpen(true)}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-canvas-soft"
            >
              Tahan
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-destructive hover:bg-canvas-soft"
            >
              <Trash className="size-4" />
              Hapus Semua
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CartItems
          swipe
          emptyAction={
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => router.push("/cashier")}
            >
              Tambah Barang dari Kasir
            </Button>
          }
        />
      </div>

      {items.length > 0 && (
        <div className="shrink-0 space-y-2 border-t border-hairline bg-canvas p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-end justify-between px-1">
            <span className="pb-1 text-sm text-ink-muted">Total ({count} item)</span>
            <span className="text-2xl font-bold tracking-tight text-ink">
              Rp{netTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/cashier")}
              className="h-12 shrink-0 rounded-full px-4 text-sm text-ink-muted"
            >
              Belanja Lagi
            </Button>
            <Button
              onClick={() => router.push("/checkout")}
              className="h-12 flex-1 rounded-full text-base"
            >
              Lanjut ke Pembayaran
            </Button>
          </div>
        </div>
      )}

      {/* Daftar pesanan ditahan */}
      <Dialog open={heldOpen} onOpenChange={(o) => !o && setHeldOpen(false)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Pesanan Ditahan</DialogTitle>
            <DialogDescription>
              Pilih pesanan untuk dilanjutkan atau hapus.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {heldCarts.map((h) => {
              const open = expandedHeld === h.id
              return (
                <div key={h.id} className="overflow-hidden rounded-xl border border-hairline bg-canvas">
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{h.label}</p>
                      <p className="text-xs text-ink-faint">
                        {h.item_count} barang · {heldDateFmt.format(new Date(h.created_at))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedHeld(open ? null : h.id)}
                      aria-label={open ? "Sembunyikan isi" : "Lihat isi"}
                      className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                    >
                      <ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResume(h)}
                      className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:bg-primary-active"
                    >
                      Lanjutkan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHeld(h)}
                      aria-label={`Hapus ${h.label}`}
                      className="shrink-0 rounded-lg p-1.5 text-ink-muted active:bg-canvas-soft"
                    >
                      <Trash className="size-4" />
                    </button>
                  </div>
                  {open && (
                    <div className="space-y-1 border-t border-hairline px-3 py-2">
                      {h.items.map((it, idx) => {
                        const price = priceOf(it)
                        const disc =
                          resolveDiscountAmount(it.product.id, price, discounts) * it.qty
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate text-ink">
                              {it.qty}× {it.product.name}
                            </span>
                            <span className="shrink-0 font-medium text-ink">
                              Rp{(price * it.qty - disc).toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeldOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog menahan keranjang aktif */}
      <Dialog open={holdOpen} onOpenChange={(o) => !o && !holding && setHoldOpen(false)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Tahan Pesanan</DialogTitle>
            <DialogDescription>
              Keranjang ({count} item) disimpan dan bisa dilanjutkan nanti.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={holdLabel}
            onChange={(e) => setHoldLabel(e.target.value)}
            placeholder="Nama pembeli / catatan (opsional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)} disabled={holding}>
              Batal
            </Button>
            <Button onClick={handleHold} disabled={holding}>
              {holding ? "Menyimpan..." : "Tahan & Mulai Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi melanjutkan saat keranjang masih berisi */}
      <Dialog open={resumeTarget !== null} onOpenChange={(o) => !o && !resuming && setResumeTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Lanjutkan Pesanan?</DialogTitle>
            <DialogDescription>
              Isi keranjang saat ini akan diganti dengan pesanan &quot;{resumeTarget?.label}&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeTarget(null)} disabled={resuming}>
              Batal
            </Button>
            <Button onClick={handleConfirmResume} disabled={resuming}>
              {resuming ? "Meneruskan..." : "Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={(o) => !o && setConfirmClear(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Kosongkan Keranjang?</DialogTitle>
            <DialogDescription>
              Semua barang di keranjang akan dihapus dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}