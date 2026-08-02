"use client"

import type { ComponentType } from "react"
import {
  User as UserIcon,
  BarChart,
  Tag,
  Cog,
  Wallet,
  Dollar,
  Zap,
  Receipt,
  ShoppingBag,
  ChartLine,
  Package,
  HelpCircle,
} from "@/components/ui/icons"
import type { UserRole } from "@/lib/hooks/use-role"

export type QuickActionKey =
  | "categories"
  | "discounts"
  | "suppliers"
  | "purchases"
  | "customers"
  | "debts"
  | "shift"
  | "expenses"
  | "reports"
  | "staff"
  | "settings"
  | "backup"
  | "help"

export type QuickAction = {
  key: QuickActionKey
  href: string
  label: string
  desc: string
  icon: ComponentType<{ className?: string }>
}

export type QuickActionGroup = {
  title: string
  items: QuickAction[]
}

const CATEGORIES: QuickAction = {
  key: "categories",
  href: "/categories",
  label: "Kategori",
  desc: "Kelola kategori barang",
  icon: Tag,
}
const DISCOUNTS: QuickAction = {
  key: "discounts",
  href: "/discounts",
  label: "Diskon",
  desc: "Kelola promo & harga diskon",
  icon: Zap,
}
const SUPPLIERS: QuickAction = {
  key: "suppliers",
  href: "/suppliers",
  label: "Supplier",
  desc: "Daftar & kelola pemasok",
  icon: Package,
}
const PURCHASES: QuickAction = {
  key: "purchases",
  href: "/purchases",
  label: "Pembelian",
  desc: "Nota beli & utang supplier",
  icon: Receipt,
}
const CUSTOMERS: QuickAction = {
  key: "customers",
  href: "/customers",
  label: "Pembeli",
  desc: "Daftar & kelola pembeli",
  icon: ShoppingBag,
}
const DEBTS: QuickAction = {
  key: "debts",
  href: "/debts",
  label: "Utang",
  desc: "Kasbon & pelunasan pembeli",
  icon: Wallet,
}
const SHIFT: QuickAction = {
  key: "shift",
  href: "/shift",
  label: "Shift Kasir",
  desc: "Buka/tutup laci & selisih kas",
  icon: Receipt,
}
const EXPENSES: QuickAction = {
  key: "expenses",
  href: "/expenses",
  label: "Pengeluaran",
  desc: "Biaya operasional & laba bersih",
  icon: Dollar,
}
const REPORTS: QuickAction = {
  key: "reports",
  href: "/reports",
  label: "Laporan",
  desc: "Laporan penjualan",
  icon: BarChart,
}
const STAFF: QuickAction = {
  key: "staff",
  href: "/staff",
  label: "Kelola Kasir",
  desc: "Tambah/hapus kasir toko",
  icon: UserIcon,
}
const SETTINGS: QuickAction = {
  key: "settings",
  href: "/settings",
  label: "Pengaturan",
  desc: "Info toko & pembayaran",
  icon: Cog,
}
const BACKUP: QuickAction = {
  key: "backup",
  href: "/backup",
  label: "Cadangan Data",
  desc: "Export / pulihkan data toko",
  icon: ChartLine,
}
const HELP: QuickAction = {
  key: "help",
  href: "/bantuan",
  label: "Bantuan & FAQ",
  desc: "Panduan pakai aplikasi",
  icon: HelpCircle,
}

// Daftar semua aksi + grup menu halaman Lainnya. Satu sumber kebenaran untuk
// label, href, dan ikon; dipakai bersama oleh halaman Lainnya & Aksi Cepat.
export const QUICK_ACTIONS: QuickAction[] = [
  CATEGORIES,
  DISCOUNTS,
  SUPPLIERS,
  PURCHASES,
  CUSTOMERS,
  DEBTS,
  SHIFT,
  EXPENSES,
  REPORTS,
  STAFF,
  SETTINGS,
  BACKUP,
  HELP,
]

export const OWNER_GROUPS: QuickActionGroup[] = [
  { title: "Barang & Promo", items: [CATEGORIES, DISCOUNTS] },
  { title: "Stok & Beli", items: [SUPPLIERS, PURCHASES] },
  { title: "Pelanggan", items: [CUSTOMERS, DEBTS] },
  { title: "Operasional", items: [SHIFT, EXPENSES, REPORTS] },
  { title: "Tim", items: [STAFF] },
  { title: "Aplikasi", items: [SETTINGS, BACKUP, HELP] },
]

export const KASIR_GROUPS: QuickActionGroup[] = [
  { title: "Operasional", items: [SHIFT] },
  { title: "Pelanggan", items: [CUSTOMERS, DEBTS] },
  { title: "Aplikasi", items: [HELP] },
]

// Aksi mana yang boleh dilihat per peran.
const ROLE_MAP: Record<QuickActionKey, UserRole[]> = {
  categories: ["owner"],
  discounts: ["owner"],
  suppliers: ["owner"],
  purchases: ["owner"],
  customers: ["owner", "kasir"],
  debts: ["owner", "kasir"],
  shift: ["owner", "kasir"],
  expenses: ["owner"],
  reports: ["owner"],
  staff: ["owner"],
  settings: ["owner"],
  backup: ["owner"],
  help: ["owner", "kasir"],
}

export function isActionForRole(action: QuickAction, role: UserRole): boolean {
  return ROLE_MAP[action.key].includes(role)
}

export function getActionByKey(key: QuickActionKey): QuickAction | undefined {
  return QUICK_ACTIONS.find((a) => a.key === key)
}

export function availableQuickActions(role: UserRole): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => isActionForRole(a, role))
}

// Preset bawaan: menu yang paling sering dibuka per peran.
const OWNER_DEFAULT: QuickActionKey[] = [
  "reports",
  "shift",
  "expenses",
  "customers",
  "categories",
  "staff",
]

const KASIR_DEFAULT: QuickActionKey[] = ["shift", "customers", "debts", "help"]

export function defaultQuickActions(role: UserRole): QuickActionKey[] {
  return role === "owner" ? [...OWNER_DEFAULT] : [...KASIR_DEFAULT]
}

// Simpan pilihan Aksi Cepat per toko per user (pola localStorage repo).
export function quickActionsStorageKey(storeId: string, userId: string): string {
  return `saberaha:quick-actions:${storeId}:${userId}`
}

export function loadQuickActions(storeId: string, userId: string): QuickActionKey[] | null {
  const raw = window.localStorage.getItem(quickActionsStorageKey(storeId, userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((k): k is QuickActionKey =>
      QUICK_ACTIONS.some((a) => a.key === k)
    )
  } catch {
    return null
  }
}

export function saveQuickActions(
  storeId: string,
  userId: string,
  keys: QuickActionKey[]
): void {
  window.localStorage.setItem(quickActionsStorageKey(storeId, userId), JSON.stringify(keys))
}
