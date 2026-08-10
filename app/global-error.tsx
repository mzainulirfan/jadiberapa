"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f5f4",
          color: "#191919",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>SABERAHA</p>
          <h1>Terjadi kesalahan aplikasi</h1>
          <p style={{ color: "#666", lineHeight: 1.5 }}>
            Coba muat ulang halaman. Data transaksi yang sudah tersimpan tetap aman.
          </p>
          {error.digest && <p style={{ color: "#888", fontSize: 12 }}>Kode: {error.digest}</p>}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "11px 18px",
              background: "#0075de",
              color: "white",
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  )
}
