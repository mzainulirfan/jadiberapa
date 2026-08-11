import { describe, expect, it } from "vitest"
import { delegationSyncDecision } from "@/lib/delegation/context"

describe("delegationSyncDecision", () => {
  it("allows an owner draft outside delegated mode", () => {
    expect(
      delegationSyncDecision(null, { active: false, status: "none", delegation: null })
    ).toBeNull()
  })

  it("allows a draft from the current delegation", () => {
    expect(
      delegationSyncDecision("delegation-1", {
        active: true,
        status: "active",
        delegation: { id: "delegation-1" },
      })
    ).toBeNull()
  })

  it("waits to sync an owner draft while delegated mode is active", () => {
    expect(
      delegationSyncDecision(null, {
        active: true,
        status: "active",
        delegation: { id: "delegation-1" },
      })
    ).toMatchObject({ type: "wait" })
  })

  it("lets the server resolve an idempotent delegated retry after mode ended", () => {
    expect(
      delegationSyncDecision("delegation-1", {
        active: false,
        status: "none",
        delegation: null,
      })
    ).toBeNull()
  })

  it("lets the server resolve an idempotent delegated retry after expiration", () => {
    expect(
      delegationSyncDecision("delegation-1", {
        active: false,
        status: "expired",
        delegation: { id: "delegation-1" },
      })
    ).toBeNull()
  })
})
