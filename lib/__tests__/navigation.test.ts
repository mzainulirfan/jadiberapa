import { describe, expect, it } from "vitest"
import {
  CONTENT_WIDTHS,
  MOBILE_TABS,
  NAV_ITEMS,
  breadcrumbs,
  getRoute,
  resolveRoute,
  routeForRole,
  routesForRole,
} from "@/lib/navigation"

describe("navigation registry", () => {
  it("keeps unique hrefs across all routes", () => {
    const hrefs = NAV_ITEMS.map((route) => route.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("exposes every route through getRoute", () => {
    for (const route of NAV_ITEMS) {
      expect(getRoute(route.href)).toBe(route)
    }
  })

  it("hides owner-only manage routes from kasir", () => {
    const owner = NAV_ITEMS.filter((route) => routeForRole(route, "owner"))
    const kasir = NAV_ITEMS.filter((route) => routeForRole(route, "kasir"))
    expect(owner.length).toBeGreaterThan(kasir.length)
    for (const route of ["/categories", "/reports", "/staff", "/settings", "/backup"]) {
      expect(routeForRole(getRoute(route)!, "owner")).toBe(true)
      expect(routeForRole(getRoute(route)!, "kasir")).toBe(false)
    }
  })

  it("lets kasir see core operational routes", () => {
    for (const route of ["/dashboard", "/cashier", "/products", "/transactions", "/shift", "/customers", "/debts"]) {
      expect(routeForRole(getRoute(route)!, "kasir")).toBe(true)
    }
  })

  it("filters groups by role", () => {
    const manage = routesForRole(
      NAV_ITEMS.filter((route) => route.group === "manage"),
      "kasir"
    )
    expect(manage).toHaveLength(0)
  })

  it("keeps mobile tabs in expected order", () => {
    expect(MOBILE_TABS.map((route) => route.href)).toEqual([
      "/dashboard",
      "/products",
      "/transactions",
      "/more",
    ])
  })
})

describe("resolveRoute", () => {
  it("resolves exact routes", () => {
    const resolved = resolveRoute("/cashier")
    expect(resolved.label).toBe("Kasir")
    expect(resolved.cartBadge).toBe(true)
    expect(resolved.contentWidth).toBe("full")
  })

  it("resolves detail routes by prefix", () => {
    expect(resolveRoute("/transactions/abc").label).toBe("Detail Transaksi")
    expect(resolveRoute("/transactions/abc").back).toBe("/transactions")
    expect(resolveRoute("/purchases/abc").label).toBe("Detail Pembelian")
  })

  it("falls back to a generic title for unknown paths", () => {
    expect(resolveRoute("/what-is-this").label).toBe("Saberaha")
    expect(resolveRoute("/what-is-this").contentWidth).toBe("standard")
  })
})

describe("breadcrumbs", () => {
  it("returns only the current page for top-level routes", () => {
    expect(breadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }])
  })

  it("builds a chain for nested checkout", () => {
    expect(breadcrumbs("/checkout")).toEqual([
      { label: "Kasir", href: "/cashier" },
      { label: "Keranjang", href: "/cart" },
      { label: "Pembayaran" },
    ])
  })

  it("builds a chain for detail pages", () => {
    expect(breadcrumbs("/transactions/x")).toEqual([
      { label: "Transaksi", href: "/transactions" },
      { label: "Detail Transaksi" },
    ])
  })
})

describe("CONTENT_WIDTHS", () => {
  it("maps every variant to a max-width utility", () => {
    expect(CONTENT_WIDTHS.full).toBe("max-w-none")
    expect(CONTENT_WIDTHS.wide).toContain("1440")
    expect(CONTENT_WIDTHS.standard).toContain("1200")
    expect(CONTENT_WIDTHS.narrow).toContain("960")
  })
})