export type DatabaseErrorLike = {
  code?: string | null
  message?: string | null
}

export function isRetryableDatabaseError(error: DatabaseErrorLike) {
  const code = error.code ?? ""
  if (
    code.startsWith("08") ||
    code.startsWith("53") ||
    code.startsWith("57P0") ||
    code === "40001" ||
    code === "40P01" ||
    code === "55P03"
  ) {
    return true
  }
  return /fetch|network|offline|timeout|connection/i.test(error.message ?? "")
}
