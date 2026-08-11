"use client"

import { createTransaction } from "@/lib/actions/transactions"
import { getCashierDelegationStatus } from "@/lib/db/delegation"
import { delegationSyncDecision } from "@/lib/delegation/context"

const DB_NAME = "saberaha-offline"
const DB_VERSION = 1
const STORE_NAME = "queued-transactions"

export type OfflineTransactionItem = {
  product_id: string
  qty: number
  unit_id?: string | null
  unit_name?: string | null
  discount?: number
  discount_mode?: "manual"
  variant_id?: string | null
  // Field berikut dipertahankan agar antrean lama tetap bisa dibaca. Server
  // tidak mempercayai nilainya untuk menghitung transaksi baru.
  price_sell?: number
  subtotal?: number
  variant_name?: string | null
  factor?: number
}

export type OfflineTransactionDraft = {
  id: string
  idempotency_key?: string
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
  delegationId?: string | null
  error?: string | null
  errorCode?: string | null
  syncStatus?: "pending" | "retry_wait" | "blocked"
  attemptCount?: number
  lastAttemptAt?: string | null
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
    let result: T
    req.onsuccess = () => {
      result = req.result
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => {
      db.close()
      resolve(result)
    }
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
  const id = draft.id ?? crypto.randomUUID()
  const item: OfflineTransactionDraft = {
    id,
    idempotency_key: draft.idempotency_key ?? id,
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
    delegationId: draft.delegationId ?? null,
    error: draft.error ?? null,
    errorCode: draft.errorCode ?? null,
    syncStatus: draft.syncStatus ?? "pending",
    attemptCount: draft.attemptCount ?? 0,
    lastAttemptAt: draft.lastAttemptAt ?? null,
  }
  return saveQueuedTransaction(item)
}

let activeSync: Promise<{ synced: number; remaining: number }> | null = null

async function runQueueSync() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, remaining: (await listQueuedTransactions()).length }
  }

  const queued = await listQueuedTransactions()
  const delegationStatus = await getCashierDelegationStatus()
  let synced = 0

  for (const item of queued) {
    if (item.syncStatus === "blocked") continue
    const delegationDecision = delegationSyncDecision(item.delegationId, delegationStatus)
    if (delegationDecision) {
      await updateQueuedTransaction(item.id, {
        error: delegationDecision.message,
        errorCode: "DELEGATION_CONTEXT_MISMATCH",
        syncStatus: delegationDecision.type === "blocked" ? "blocked" : "retry_wait",
        lastAttemptAt: new Date().toISOString(),
      })
      continue
    }
    try {
      const res = await createTransaction(
        item.items,
        item.payment_method,
        item.customer_id ?? null,
        item.paid_amount,
        item.discount,
        item.fee,
        item.points_redeemed,
        item.idempotency_key ?? item.id,
        item.delegationId ?? null
      )
      if (res?.error) {
        if (res.errorCode === "DELEGATION_CONTEXT_MISMATCH" && !item.delegationId) {
          await updateQueuedTransaction(item.id, {
            error: "Transaksi owner menunggu sampai mode kasir diakhiri.",
            errorCode: res.errorCode,
            syncStatus: "retry_wait",
            lastAttemptAt: new Date().toISOString(),
          })
          continue
        }
        const attemptCount = (item.attemptCount ?? 0) + 1
        const blocked = !res.retryable || attemptCount >= 5
        await updateQueuedTransaction(item.id, {
          error: res.error,
          errorCode: res.errorCode ?? null,
          syncStatus: blocked ? "blocked" : "retry_wait",
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
        })
        continue
      }
      await deleteQueuedTransaction(item.id)
      synced += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal sinkron transaksi offline"
      const attemptCount = (item.attemptCount ?? 0) + 1
      await updateQueuedTransaction(item.id, {
        error: message,
        errorCode: "NETWORK_ERROR",
        syncStatus: attemptCount >= 5 ? "blocked" : "retry_wait",
        attemptCount,
        lastAttemptAt: new Date().toISOString(),
      })
    }
  }

  const remaining = (await listQueuedTransactions()).length
  return { synced, remaining }
}

export function syncQueuedTransactions() {
  if (activeSync) return activeSync
  activeSync = runQueueSync().finally(() => {
    activeSync = null
  })
  return activeSync
}

export function onQueuedTransactionsChange(handler: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("saberaha-offline-transactions-changed", handler as EventListener)
  return () => window.removeEventListener("saberaha-offline-transactions-changed", handler as EventListener)
}
