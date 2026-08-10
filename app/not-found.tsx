import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-soft px-5 py-10">
      <div className="text-center">
        <p className="text-5xl font-bold tracking-tight text-primary">404</p>
        <h1 className="mt-3 text-xl font-bold text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-muted">Alamat yang dibuka mungkin sudah berubah.</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  )
}
