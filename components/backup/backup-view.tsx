"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { restoreStoreBackup } from "@/lib/actions/backup"
import { resetCatalog } from "@/lib/actions/products"
import type { StoreBackupBundle, StoreBackupCounts } from "@/lib/backup/types"
import { AlertTriangle, Receipt, Store } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const APP_VERSION = "Saberaha v1.0.0"

function emptyCounts(): StoreBackupCounts {
  return {
    settings: 0,
    categories: 0,
    products: 0,
    product_units: 0,
    product_variants: 0,
    customers: 0,
    suppliers: 0,
    purchases: 0,
    purchase_items: 0,
    supplier_payments: 0,
    expenses: 0,
    discounts: 0,
    discount_products: 0,
    cash_sessions: 0,
    transactions: 0,
    transaction_items: 0,
    payments: 0,
    stock_movements: 0,
    loyalty_ledger: 0,
  }
}

function countBundle(bundle: StoreBackupBundle): StoreBackupCounts {
  return {
    settings: bundle.settings.length,
    categories: bundle.categories.length,
    products: bundle.products.length,
    product_units: (bundle.product_units ?? []).length,
    product_variants: bundle.product_variants.length,
    customers: bundle.customers.length,
    suppliers: bundle.suppliers.length,
    purchases: bundle.purchases.length,
    purchase_items: bundle.purchase_items.length,
    supplier_payments: bundle.supplier_payments.length,
    expenses: bundle.expenses.length,
    discounts: bundle.discounts.length,
    discount_products: bundle.discount_products.length,
    cash_sessions: bundle.cash_sessions.length,
    transactions: bundle.transactions.length,
    transaction_items: bundle.transaction_items.length,
    payments: bundle.payments.length,
    stock_movements: bundle.stock_movements.length,
    loyalty_ledger: (bundle.loyalty_ledger ?? []).length,
  }
}

function summarizeCounts(counts: StoreBackupCounts) {
  return Object.entries(counts)
    .map(([key, value]) => `${key}:${value}`)
    .join(" · ")
}

function safeFileName(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-")
}

function downloadJson(bundle: StoreBackupBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `backup-${safeFileName(bundle.meta.store_name || "toko")}-${bundle.meta.exported_at.slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function loadCurrentBundle(): Promise<StoreBackupBundle> {
  const supabase = createClient()
  const [settings, categories, products, productUnits, productVariants, customers, suppliers, purchases, purchaseItems, supplierPayments, expenses, discounts, discountProducts, cashSessions, transactions, transactionItems, payments, stockMovements, loyaltyLedger] = await Promise.all([
    supabase.from("settings").select("key, value").order("key"),
    supabase.from("categories").select("*").order("created_at", { ascending: true }),
    supabase.from("products").select("*").order("created_at", { ascending: true }),
    supabase.from("product_units").select("*").order("created_at", { ascending: true }),
    supabase.from("product_variants").select("*").order("created_at", { ascending: true }),
    supabase.from("customers").select("*").order("created_at", { ascending: true }),
    supabase.from("suppliers").select("*").order("created_at", { ascending: true }),
    supabase.from("purchases").select("*").order("created_at", { ascending: true }),
    supabase.from("purchase_items").select("*").order("created_at", { ascending: true }),
    supabase.from("supplier_payments").select("*").order("created_at", { ascending: true }),
    supabase.from("expenses").select("*").order("created_at", { ascending: true }),
    supabase.from("discounts").select("*").order("created_at", { ascending: true }),
    supabase.from("discount_products").select("*"),
    supabase.from("cash_sessions").select("*").order("opened_at", { ascending: true }),
    supabase.from("transactions").select("*").order("created_at", { ascending: true }),
    supabase.from("transaction_items").select("*").order("created_at", { ascending: true }),
    supabase.from("payments").select("*").order("created_at", { ascending: true }),
    supabase.from("stock_movements").select("*").order("created_at", { ascending: true }),
    supabase.from("loyalty_ledger").select("*").order("created_at", { ascending: true }),
  ])

  const errors = [
    settings.error,
    categories.error,
    products.error,
    productUnits.error,
    productVariants.error,
    customers.error,
    suppliers.error,
    purchases.error,
    purchaseItems.error,
    supplierPayments.error,
    expenses.error,
    discounts.error,
    discountProducts.error,
    cashSessions.error,
    transactions.error,
    transactionItems.error,
    payments.error,
    stockMovements.error,
    loyaltyLedger.error,
  ].filter(Boolean)
  if (errors.length > 0) {
    throw new Error("Gagal memuat data toko")
  }

  const settingsMap = (settings.data ?? []) as { key: string; value: string }[]
  const storeName = settingsMap.find((row) => row.key === "store_name")?.value || "Toko Saya"

  return {
    meta: {
      exported_at: new Date().toISOString(),
      app_version: APP_VERSION,
      store_name: storeName,
    },
    settings: settingsMap,
    categories: (categories.data ?? []) as StoreBackupBundle["categories"],
    products: (products.data ?? []) as StoreBackupBundle["products"],
    product_units: (productUnits.data ?? []) as StoreBackupBundle["product_units"],
    product_variants: (productVariants.data ?? []) as StoreBackupBundle["product_variants"],
    customers: (customers.data ?? []) as StoreBackupBundle["customers"],
    suppliers: (suppliers.data ?? []) as StoreBackupBundle["suppliers"],
    purchases: (purchases.data ?? []) as StoreBackupBundle["purchases"],
    purchase_items: (purchaseItems.data ?? []) as StoreBackupBundle["purchase_items"],
    supplier_payments: (supplierPayments.data ?? []) as StoreBackupBundle["supplier_payments"],
    expenses: (expenses.data ?? []) as StoreBackupBundle["expenses"],
    discounts: (discounts.data ?? []) as StoreBackupBundle["discounts"],
    discount_products: (discountProducts.data ?? []) as StoreBackupBundle["discount_products"],
    cash_sessions: (cashSessions.data ?? []) as StoreBackupBundle["cash_sessions"],
    transactions: (transactions.data ?? []) as StoreBackupBundle["transactions"],
    transaction_items: (transactionItems.data ?? []) as StoreBackupBundle["transaction_items"],
    payments: (payments.data ?? []) as StoreBackupBundle["payments"],
    stock_movements: (stockMovements.data ?? []) as StoreBackupBundle["stock_movements"],
    loyalty_ledger: (loyaltyLedger.data ?? []) as StoreBackupBundle["loyalty_ledger"],
  }
}

export function BackupView() {
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<StoreBackupBundle | null>(null)
  const [snapshotCounts, setSnapshotCounts] = useState<StoreBackupCounts>(emptyCounts())
  const [exporting, setExporting] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreBundle, setRestoreBundle] = useState<StoreBackupBundle | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetCategories, setResetCategories] = useState(false)
  const [resetConfirm, setResetConfirm] = useState("")
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const bundle = await loadCurrentBundle()
        if (!active) return
        setSnapshot(bundle)
        setSnapshotCounts(countBundle(bundle))
      } catch {
        if (active) toast.error("Gagal memuat data cadangan")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const hasSnapshot = !!snapshot
  const totalRows = useMemo(
    () => Object.values(snapshotCounts).reduce((sum, value) => sum + value, 0),
    [snapshotCounts]
  )

  async function handleExport() {
    try {
      setExporting(true)
      const bundle = await loadCurrentBundle()
      setSnapshot(bundle)
      setSnapshotCounts(countBundle(bundle))
      downloadJson(bundle)
      toast.success("Cadangan diunduh")
    } catch {
      toast.error("Gagal membuat cadangan")
    } finally {
      setExporting(false)
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const bundle = JSON.parse(text) as StoreBackupBundle
      if (!bundle?.meta?.exported_at || !bundle?.settings || !bundle?.products) {
        throw new Error("Struktur backup tidak valid")
      }
      setRestoreBundle(bundle)
      setRestoreOpen(true)
    } catch {
      toast.error("File backup tidak valid")
    }
  }

  async function confirmRestore() {
    if (!restoreBundle) return
    setRestoring(true)
    try {
      const res = await restoreStoreBackup(restoreBundle)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Data berhasil dipulihkan")
      setRestoreOpen(false)
      setRestoreBundle(null)
      window.location.reload()
    } finally {
      setRestoring(false)
    }
  }

  const restoreCounts = restoreBundle ? countBundle(restoreBundle) : emptyCounts()

  async function confirmReset() {
    if (resetConfirm.trim().toLowerCase() !== "reset") return
    setResetting(true)
    const res = await resetCatalog(resetCategories)
    setResetting(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success(
      `${res.deletedProducts} barang dihapus` +
        (resetCategories ? `, ${res.deletedCategories} kategori` : "")
    )
    setResetOpen(false)
    setResetConfirm("")
    window.location.reload()
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Receipt className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Cadangan Data</p>
            <p className="text-xs text-ink-faint">Export dan pulihkan data toko aktif.</p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-20 w-full rounded-xl" />
        ) : (
          <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-3 text-xs text-ink-muted">
            <p className="font-medium text-ink">Snapshot saat ini</p>
            <p className="mt-1">{snapshot?.meta.store_name || "Toko Saya"}</p>
            <p className="mt-1 text-ink-faint">{totalRows} baris data · {summarizeCounts(snapshotCounts)}</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-canvas p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
              <Receipt className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Unduh Cadangan</p>
              <p className="text-xs text-ink-faint">Simpan semua data toko ke file JSON.</p>
            </div>
          </div>
          <Button className="w-full rounded-full" disabled={exporting || loading || !hasSnapshot} onClick={handleExport}>
            {exporting ? "Membuat file..." : "Unduh JSON"}
          </Button>
        </div>

        <div className="rounded-2xl border border-hairline bg-canvas p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-orange/10 text-accent-orange">
              <Store className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Pulihkan Cadangan</p>
              <p className="text-xs text-ink-faint">File JSON akan menimpa data toko aktif.</p>
            </div>
          </div>
          <label className="flex w-full cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas-soft px-3 py-2.5 text-sm font-medium text-ink active:bg-canvas">
            Pilih File JSON
            <Input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void handleFileChange(e.target.files?.[0] ?? null)
                e.target.value = ""
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4" />
          <p className="font-semibold">Peringatan</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-amber-900/80">
          Restore akan menghapus data toko aktif dulu, lalu mengisi ulang dari file backup.
          Gunakan hanya jika file memang berasal dari toko yang sama.
        </p>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-canvas p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Reset Data Barang</p>
            <p className="text-xs text-ink-faint">Hapus seluruh barang (dan kategori) toko aktif.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setResetCategories(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left text-sm",
              !resetCategories ? "border-primary bg-primary/10" : "border-hairline bg-canvas-soft"
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border-2 border-ink-faint">
              {!resetCategories && <span className="size-2.5 rounded-full bg-primary" />}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-ink">Reset barang saja</span>
              <span className="text-xs text-ink-muted">Hapus semua produk, kategori tetap dipertahankan.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setResetCategories(true)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm",
              resetCategories
                ? "border-primary bg-primary/10"
                : "border-hairline bg-canvas-soft"
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border-2 border-ink-faint">
              {resetCategories && <span className="size-2.5 rounded-full bg-primary" />}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-ink">Reset barang + kategori</span>
              <span className="text-xs text-ink-muted">Hapus semua produk dan semua kategori sekaligus.</span>
            </span>
          </button>
        </div>

        <Button
          variant="destructive"
          className="w-full rounded-full"
          disabled={loading || !hasSnapshot}
          onClick={() => setResetOpen(true)}
        >
          Reset Data
        </Button>
      </div>

      <Dialog open={restoreOpen} onOpenChange={(o) => !restoring && setRestoreOpen(o)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Pulihkan data dari backup?</DialogTitle>
            <DialogDescription>
              Snapshot ini berisi {restoreBundle ? totalRows : 0} baris data. Data saat ini akan ditimpa.
            </DialogDescription>
          </DialogHeader>
          {restoreBundle && (
            <div className="rounded-xl border border-hairline bg-canvas-soft p-3 text-xs text-ink-muted">
              <p className="font-medium text-ink">{restoreBundle.meta.store_name}</p>
              <p className="mt-1">{restoreBundle.meta.exported_at}</p>
              <p className="mt-1 text-ink-faint">{summarizeCounts(restoreCounts)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmRestore} disabled={restoring || !restoreBundle}>
              {restoring ? "Memulihkan..." : "Pulihkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={(o) => !resetting && setResetOpen(o)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset data barang?</DialogTitle>
            <DialogDescription>
              {resetCategories
                ? "Semua produk dan kategori toko aktif akan dihapus permanen."
                : "Semua produk toko aktif akan dihapus permanen."}{" "}
              Ketik <span className="font-mono font-semibold text-destructive">reset</span> untuk melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="ketik: reset"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReset}
              disabled={resetting || resetConfirm.trim().toLowerCase() !== "reset"}
            >
              {resetting ? "Mereset..." : "Reset Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
