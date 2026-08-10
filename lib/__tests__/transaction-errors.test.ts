import { describe, expect, it } from "vitest"
import { isRetryableDatabaseError } from "@/lib/transactions/errors"

describe("isRetryableDatabaseError", () => {
  it.each(["08006", "40001", "40P01", "55P03", "53300", "57P01"])(
    "menandai SQLSTATE %s sebagai retryable",
    (code) => expect(isRetryableDatabaseError({ code })).toBe(true)
  )

  it("mengenali error jaringan tanpa SQLSTATE", () => {
    expect(isRetryableDatabaseError({ message: "fetch failed" })).toBe(true)
  })

  it("tidak mengulang error data permanen", () => {
    expect(isRetryableDatabaseError({ code: "22003", message: "integer out of range" })).toBe(false)
    expect(isRetryableDatabaseError({ code: "23503", message: "foreign key" })).toBe(false)
  })
})
