import { describe, expect, it } from "vitest"
import { faqGroups } from "@/lib/faq/content"

describe("konten FAQ", () => {
  it("memiliki minimal 1 grup dan semua grup berisi item", () => {
    expect(faqGroups.length).toBeGreaterThan(0)
    for (const group of faqGroups) {
      expect(group.id).toBeTruthy()
      expect(group.title).toBeTruthy()
      expect(group.items.length).toBeGreaterThan(0)
    }
  })

  it("semua item punya id unik, pertanyaan & jawaban tidak kosong", () => {
    const ids = new Set<string>()
    for (const group of faqGroups) {
      for (const item of group.items) {
        expect(item.id).toBeTruthy()
        expect(ids.has(item.id)).toBe(false)
        ids.add(item.id)
        expect(item.q.trim().length).toBeGreaterThan(0)
        expect(item.a.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("href (deep-link) selalu route absolut dan dikenal", () => {
    const knownRoutes = new Set([
      "/register",
      "/register?mode=kasir",
      "/login",
      "/more",
      "/products",
      "/categories",
      "/customers",
      "/discounts",
      "/purchases",
      "/expenses",
      "/cashier",
      "/debts",
      "/shift",
      "/settings",
      "/staff",
      "/reports",
      "/backup",
    ])
    for (const group of faqGroups) {
      for (const item of group.items) {
        if (!item.href) continue
        expect(knownRoutes.has(item.href)).toBe(true)
      }
    }
  })
})
