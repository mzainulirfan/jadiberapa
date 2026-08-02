import { describe, expect, it } from "vitest"
import { landingContent, featureIcons } from "@/lib/landing/content"

describe("konten landing page", () => {
  it("hero punya badge, judul, subjudul & CTA yang terisi", () => {
    const { hero } = landingContent
    expect(hero.badge.trim().length).toBeGreaterThan(0)
    expect(hero.title.trim().length).toBeGreaterThan(0)
    expect(hero.subtitle.trim().length).toBeGreaterThan(0)
    expect(hero.primaryCta.trim().length).toBeGreaterThan(0)
    expect(hero.secondaryCta.trim().length).toBeGreaterThan(0)
  })

  it("langkah-langkah berurutan dan terisi (minimal 3)", () => {
    expect(landingContent.steps.length).toBeGreaterThanOrEqual(3)
    for (const step of landingContent.steps) {
      expect(step.title.trim().length).toBeGreaterThan(0)
      expect(step.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("fitur memakai ikon yang dikenali & judul/deskripsi terisi (minimal 6)", () => {
    expect(landingContent.features.length).toBeGreaterThanOrEqual(6)
    const titles = new Set<string>()
    for (const feature of landingContent.features) {
      expect(featureIcons.includes(feature.icon)).toBe(true)
      expect(titles.has(feature.title)).toBe(false)
      titles.add(feature.title)
      expect(feature.title.trim().length).toBeGreaterThan(0)
      expect(feature.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("FAQ teaser terisi dan pertanyaan tidak duplikat", () => {
    expect(landingContent.faqTeaser.length).toBeGreaterThan(0)
    const questions = new Set<string>()
    for (const item of landingContent.faqTeaser) {
      expect(item.q.trim().length).toBeGreaterThan(0)
      expect(item.a.trim().length).toBeGreaterThan(0)
      expect(questions.has(item.q)).toBe(false)
      questions.add(item.q)
    }
  })
})
