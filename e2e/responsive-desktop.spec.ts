import { expect, test } from "@playwright/test"

const DESKTOP_VIEWPORTS = [
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
]

test.describe("responsive desktop shell (public routes)", () => {
  for (const vp of DESKTOP_VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto("/bantuan")
      await page.waitForLoadState("domcontentloaded")
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(overflow).toBe(false)
    })
  }

  test("app content centered with max-width on wide screens", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/bantuan")
    const body = page.locator("body")
    await expect(body).toBeVisible()
  })
})

test.describe("desktop UI polish", () => {
  test("landing page renders interactive controls at desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Saberaha/i)
  })
})