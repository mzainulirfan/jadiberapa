import type { ComponentType } from "react"
import {
  Dashboard as DashboardIcon,
  CartAlt as CashierIcon,
  Package as PackageIcon,
  Receipt as ReceiptIcon,
  ShoppingBag as CustomersIcon,
  Wallet as DebtsIcon,
  Tag as CategoriesIcon,
  Zap as DiscountsIcon,
  Dollar as ExpensesIcon,
  BarChart as ReportsIcon,
  User as StaffIcon,
  Cog as SettingsIcon,
  Download as BackupIcon,
  HelpCircle as HelpIcon,
  DotsHorizontalRounded as MoreIcon,
} from "@/components/ui/icons"

// Pintu masuk navigasi utama. Satu sumber kebenaran untuk label, ikon, role,
// group, breadcrumb, serta lebar konten; dipakai Sidebar, Header, BottomNav,
// dan DesktopHeader.
export type NavRole = "owner" | "kasir"
export type NavGroup = "primary" | "operations" | "manage" | "system"
export type ContentWidth = "full" | "wide" | "standard" | "narrow"

export type AppRoute = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Role yang boleh melihat route ini. */
  roles: NavRole[]
  group: NavGroup
  /** Ditampilkan di bottom navigation mobile. */
  mobileTab?: boolean
  /** Tujuan tombol kembali pada header mobile. */
  back?: string
  /** Route induk untuk breadcrumb desktop ("parent" navigasi sebenarnya). */
  parent?: string
  contentWidth: ContentWidth
  desc?: string
  /** Tampilkan badge jumlah keranjang pada item navigasi. */
  cartBadge?: boolean
}

export const NAV_DASHBOARD: AppRoute = {
  href: "/dashboard",
  label: "Dashboard",
  icon: DashboardIcon,
  roles: ["owner", "kasir"],
  group: "primary",
  mobileTab: true,
  contentWidth: "wide",
}

export const NAV_CASHIER: AppRoute = {
  href: "/cashier",
  label: "Kasir",
  icon: CashierIcon,
  roles: ["owner", "kasir"],
  group: "primary",
  cartBadge: true,
  contentWidth: "full",
}

export const NAV_PRODUCTS: AppRoute = {
  href: "/products",
  label: "Barang",
  icon: PackageIcon,
  roles: ["owner", "kasir"],
  group: "primary",
  mobileTab: true,
  contentWidth: "wide",
}

export const NAV_TRANSACTIONS: AppRoute = {
  href: "/transactions",
  label: "Transaksi",
  icon: ReceiptIcon,
  roles: ["owner", "kasir"],
  group: "primary",
  mobileTab: true,
  contentWidth: "wide",
}

export const NAV_SHIFT: AppRoute = {
  href: "/shift",
  label: "Shift Kasir",
  icon: ReceiptIcon,
  roles: ["owner", "kasir"],
  group: "operations",
  back: "/more",
  contentWidth: "standard",
  desc: "Buka/tutup laci & selisih kas",
}

export const NAV_CUSTOMERS: AppRoute = {
  href: "/customers",
  label: "Pembeli",
  icon: CustomersIcon,
  roles: ["owner", "kasir"],
  group: "operations",
  back: "/more",
  contentWidth: "standard",
  desc: "Daftar & kelola pembeli",
}

export const NAV_DEBTS: AppRoute = {
  href: "/debts",
  label: "Utang",
  icon: DebtsIcon,
  roles: ["owner", "kasir"],
  group: "operations",
  back: "/more",
  contentWidth: "standard",
  desc: "Kasbon & pelunasan pembeli",
}

export const NAV_CATEGORIES: AppRoute = {
  href: "/categories",
  label: "Kategori",
  icon: CategoriesIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
}

export const NAV_DISCOUNTS: AppRoute = {
  href: "/discounts",
  label: "Diskon",
  icon: DiscountsIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
}

export const NAV_SUPPLIERS: AppRoute = {
  href: "/suppliers",
  label: "Supplier",
  icon: PackageIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
}

export const NAV_PURCHASES: AppRoute = {
  href: "/purchases",
  label: "Pembelian",
  icon: ReceiptIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
}

export const NAV_EXPENSES: AppRoute = {
  href: "/expenses",
  label: "Pengeluaran",
  icon: ExpensesIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
}

export const NAV_REPORTS: AppRoute = {
  href: "/reports",
  label: "Laporan",
  icon: ReportsIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "wide",
}

export const NAV_STAFF: AppRoute = {
  href: "/staff",
  label: "Kelola Kasir",
  icon: StaffIcon,
  roles: ["owner"],
  group: "manage",
  back: "/more",
  contentWidth: "standard",
  desc: "Tambah/hapus kasir toko",
}

export const NAV_SETTINGS: AppRoute = {
  href: "/settings",
  label: "Pengaturan",
  icon: SettingsIcon,
  roles: ["owner"],
  group: "system",
  back: "/more",
  contentWidth: "narrow",
}

export const NAV_BACKUP: AppRoute = {
  href: "/backup",
  label: "Cadangan Data",
  icon: BackupIcon,
  roles: ["owner"],
  group: "system",
  back: "/more",
  contentWidth: "narrow",
}

export const NAV_HELP: AppRoute = {
  href: "/bantuan",
  label: "Bantuan & FAQ",
  icon: HelpIcon,
  roles: ["owner", "kasir"],
  group: "system",
  back: "/more",
  contentWidth: "narrow",
}

export const NAV_CART: AppRoute = {
  href: "/cart",
  label: "Keranjang",
  icon: CashierIcon,
  roles: ["owner", "kasir"],
  group: "system",
  back: "/cashier",
  parent: "/cashier",
  contentWidth: "standard",
}

export const NAV_CHECKOUT: AppRoute = {
  href: "/checkout",
  label: "Pembayaran",
  icon: CashierIcon,
  roles: ["owner", "kasir"],
  group: "system",
  back: "/cart",
  parent: "/cart",
  contentWidth: "standard",
}

export const NAV_MORE: AppRoute = {
  href: "/more",
  label: "Lainnya",
  icon: MoreIcon,
  roles: ["owner", "kasir"],
  group: "system",
  mobileTab: true,
  contentWidth: "standard",
}

// Urutan tab bottom navigation mobile (Kasir dibuat tombol tengah khusus).
export const MOBILE_TABS: AppRoute[] = [
  NAV_DASHBOARD,
  NAV_PRODUCTS,
  NAV_TRANSACTIONS,
  NAV_MORE,
]

// Grup sidebar desktop dalam urutan tampil.
export const NAV_GROUPS: { title: string; routes: AppRoute[] }[] = [
  { title: "Utama", routes: [NAV_DASHBOARD, NAV_CASHIER, NAV_PRODUCTS, NAV_TRANSACTIONS] },
  { title: "Operasional", routes: [NAV_SHIFT, NAV_CUSTOMERS, NAV_DEBTS] },
  {
    title: "Kelola",
    routes: [
      NAV_CATEGORIES,
      NAV_DISCOUNTS,
      NAV_SUPPLIERS,
      NAV_PURCHASES,
      NAV_EXPENSES,
      NAV_REPORTS,
      NAV_STAFF,
    ],
  },
  { title: "Aplikasi", routes: [NAV_SETTINGS, NAV_BACKUP, NAV_HELP] },
]

export const NAV_ITEMS: AppRoute[] = NAV_GROUPS.flatMap((g) => g.routes).concat([
  NAV_CART,
  NAV_CHECKOUT,
])

// Variant lebar konten halaman lintas breakpoint desktop.
export const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  full: "max-w-none",
  wide: "max-w-[1440px]",
  standard: "max-w-[1200px]",
  narrow: "max-w-[960px]",
}

/** Rute detail bersifat dinamis (prefix) dan tidak terdaftar sebagai item statis. */
const DETAIL_ROUTES: {
  prefix: string
  meta: Pick<AppRoute, "label" | "back" | "parent" | "contentWidth">
}[] = [
  {
    prefix: "/transactions/",
    meta: {
      label: "Detail Transaksi",
      back: "/transactions",
      parent: "/transactions",
      contentWidth: "standard",
    },
  },
  {
    prefix: "/purchases/",
    meta: {
      label: "Detail Pembelian",
      back: "/purchases",
      parent: "/purchases",
      contentWidth: "standard",
    },
  },
]

export type ResolvedRoute = {
  href: string
  label: string
  icon?: ComponentType<{ className?: string }>
  back?: string
  parent?: string
  contentWidth: ContentWidth
  cartBadge?: boolean
}

export function getRoute(href: string): AppRoute | undefined {
  return NAV_ITEMS.find((route) => route.href === href)
}

export function routeForRole(route: AppRoute, role: NavRole): boolean {
  return route.roles.includes(role)
}

export function routesForRole(routes: AppRoute[], role: NavRole): AppRoute[] {
  return routes.filter((route) => routeForRole(route, role))
}

/** Resolusi route dari pathname: exact match, lalu rute detail ber-prefix. */
export function resolveRoute(pathname: string): ResolvedRoute {
  const exact = getRoute(pathname)
  if (exact) {
    return {
      href: pathname,
      label: exact.label,
      icon: exact.icon,
      back: exact.back,
      parent: exact.parent,
      contentWidth: exact.contentWidth,
      cartBadge: exact.cartBadge,
    }
  }

  for (const detail of DETAIL_ROUTES) {
    if (pathname.startsWith(detail.prefix) && pathname !== detail.prefix) {
      return {
        href: pathname,
        label: detail.meta.label,
        back: detail.meta.back,
        parent: detail.meta.parent,
        contentWidth: detail.meta.contentWidth,
      }
    }
  }

  return { href: pathname, label: "Saberaha", contentWidth: "standard" }
}

export type Crumb = { label: string; href?: string }

/** Breadcrumb top-down dari route induk ke halaman saat ini. */
export function breadcrumbs(pathname: string): Crumb[] {
  const seen = new Set<string>()
  const chain: Crumb[] = []
  let current: ResolvedRoute | null = resolveRoute(pathname)

  while (current) {
    if (seen.has(current.href)) break
    seen.add(current.href)
    chain.unshift({ label: current.label, href: current.href })

    if (!current.parent) break
    const parent = getRoute(current.parent)
    if (!parent) break
    current = {
      href: parent.href,
      label: parent.label,
      parent: parent.parent,
      contentWidth: parent.contentWidth,
    }
  }

  // Halaman saat ini tidak perlu tautan.
  return chain.map((crumb, index) =>
    index === chain.length - 1 ? { label: crumb.label } : crumb
  )
}