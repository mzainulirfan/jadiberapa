export type DelegationContextStatus = {
  active: boolean
  status: "none" | "active" | "expired" | "invalid"
  delegation: { id: string } | null
}

export type DelegationSyncDecision =
  | { type: "wait" | "blocked"; message: string }
  | null

export function delegationSyncDecision(
  draftDelegationId: string | null | undefined,
  context: DelegationContextStatus
): DelegationSyncDecision {
  const draftId = draftDelegationId ?? null
  const activeId = context.active ? context.delegation?.id ?? null : null

  if (activeId && draftId === activeId) return null
  if (!activeId && context.status === "none" && draftId === null) return null

  // Let the atomic checkout wrapper resolve an idempotent retry even after its
  // delegation ended. If it was never committed, the wrapper rejects it.
  if (draftId) {
    return null
  }

  return {
    type: "wait",
    message: "Transaksi owner menunggu sampai mode kasir diakhiri.",
  }
}
