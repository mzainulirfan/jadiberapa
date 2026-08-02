"use client"

import { createTransaction } from "@/lib/actions/transactions"

const DB_NAME = "saberaha-offline"
const DB_VERSION = 1
const STORE_NAME = "queued-transactions"

export type OfflineTransactionItem = {
  product_id: string
  qty: number
  price_sell: number
  subtotal: number
  discount?: number
  variant_id?: string | null
  variant_name?: string | null
  unit_name?: string | null
  factor?: number
}

export type OfflineTransactionDraft = {
  id: string
  createdAt: string
  items: OfflineTransactionItem[]
  payment_method: string
  customer_id?: string | null
  paid_amount?: number
  discount?: number
  fee?: number
  points_redeemed?: number
  total: number
  itemCount: number
  customerName?: string | null
  cashierName?: string | null
  error?: string | null
}

function emitQueueChange() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("saberaha-offline-transactions-changed"))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function listQueuedTransactions(): Promise<OfflineTransactionDraft[]> {
  if (typeof indexedDB === "undefined") return []
  const items = await withStore<OfflineTransactionDraft[]>("readonly", (store) => store.getAll())
  return (items ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getQueuedTransaction(id: string): Promise<OfflineTransactionDraft | null> {
  if (typeof indexedDB === "undefined") return null
  return await withStore<OfflineTransactionDraft | undefined>("readonly", (store) => store.get(id)).then(
    (item) => item ?? null
  )
}

export async function saveQueuedTransaction(item: OfflineTransactionDraft) {
  if (typeof indexedDB === "undefined") return item
  await withStore("readwrite", (store) => store.put(item))
  emitQueueChange()
  return item
}

export async function deleteQueuedTransaction(id: string) {
  if (typeof indexedDB === "undefined") return
  await withStore("readwrite", (store) => store.delete(id))
  emitQueueChange()
}

export async function updateQueuedTransaction(id: string, patch: Partial<OfflineTransactionDraft>) {
  const existing = await getQueuedTransaction(id)
  if (!existing) return null
  const next = { ...existing, ...patch }
  await saveQueuedTransaction(next)
  return next
}

export async function queueOfflineTransaction(
  draft: Omit<OfflineTransactionDraft, "id" | "createdAt"> & { id?: string; createdAt?: string }
) {
  const item: OfflineTransactionDraft = {
    id: draft.id ?? crypto.randomUUID(),
    createdAt: draft.createdAt ?? new Date().toISOString(),
    items: draft.items,
    payment_method: draft.payment_method,
    customer_id: draft.customer_id ?? null,
    paid_amount: draft.paid_amount,
    discount: draft.discount,
    fee: draft.fee,
    points_redeemed: draft.points_redeemed,
    total: draft.total,
    itemCount: draft.itemCount,
    customerName: draft.customerName ?? null,
    cashierName: draft.cashierName ?? null,
    error: draft.error ?? null,
  }
  return saveQueuedTransaction(item)
}

export async function syncQueuedTransactions() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, remaining: 0 }
  }

  const queued = await listQueuedTransactions()
  let synced = 0

  for (const item of queued) {
    try {
      const res = await createTransaction(
        item.items,
        item.payment_method,
        item.customer_id ?? null,
        item.paid_amount,
        item.discount,
        item.fee,
        item.points_redeemed
      )
      if (res?.error) {
        await updateQueuedTransaction(item.id, { error: res.error })
        continue
      }
      await deleteQueuedTransaction(item.id)
      synced += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal sinkron transaksi offline"
      await updateQueuedTransaction(item.id, { error: message })
    }
  }

  emitQueueChange()
  const remaining = (await listQueuedTransactions()).length
  return { synced, remaining }
}

export function onQueuedTransactionsChange(handler: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("saberaha-offline-transactions-changed", handler as EventListener)
  return () => window.removeEventListener("saberaha-offline-transactions-changed", handler as EventListener)
}
