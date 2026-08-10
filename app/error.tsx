"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled application error", error)
    const reportUrl = process.env.NEXT_PUBLIC_ERROR_REPORT_URL
    if (reportUrl) {
      void fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: error.digest ?? null, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-soft px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-canvas p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Saberaha</p>
        <h1 className="mt-3 text-xl font-bold text-ink">Halaman mengalami kendala</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Data belum berubah. Coba muat ulang halaman atau kembali ke dashboard.
        </p>
        {error.digest && <p className="mt-3 text-[11px] text-ink-faint">Kode: {error.digest}</p>}
        <div className="mt-5 flex gap-2">
          <Button className="flex-1 rounded-full" onClick={() => reset()}>
            Coba lagi
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex flex-1 items-center justify-center rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
