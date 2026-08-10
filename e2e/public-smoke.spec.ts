import { expect, test } from "@playwright/test"

test.describe("public routes", () => {
  test("landing page loads", async ({ page }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Saberaha/i)
  })

  test("help page loads without authentication", async ({ page }) => {
    const response = await page.goto("/bantuan")
    expect(response?.status()).toBe(200)
    await expect(page.locator("body")).toContainText(/bantuan/i)
  })

  test("manifest is valid", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest")
    expect(response.status()).toBe(200)
    const manifest = await response.json()
    expect(manifest.name).toMatch(/Saberaha/i)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  })
})
