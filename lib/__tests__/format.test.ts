import { describe, expect, it } from "vitest"
import { fmtRp } from "@/lib/format"

describe("fmtRp", () => {
  it("memformat angka menjadi rupiah dengan pemisah ribuan", () => {
    expect(fmtRp(0)).toBe("Rp0")
    expect(fmtRp(10000)).toBe("Rp10.000")
    expect(fmtRp(1234567)).toBe("Rp1.234.567")
  })
})
