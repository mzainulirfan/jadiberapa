// Service worker Saberaha — cache asset statis agar app yang sedang terbuka
// tetap bisa dipakai saat offline.
// Strategi:
//  - Aset statis (_next/static, /icon, gambar) : cache-first + refresh di belakang.
//  - Navigasi halaman authenticated             : network-only.
//  - Request lain (Supabase, POST, cross-origin): dibiarkan (network langsung).
// PENTING: jangan cache HTML authenticated/public receipt karena bisa menyimpan
// data toko atau data pembeli di perangkat bersama.

const VERSION = "v3"
const STATIC_CACHE = `saberaha-static-${VERSION}`
const PUBLIC_NAVIGATION = new Set(["/", "/login", "/register", "/bantuan"])
const OFFLINE_URL = "/offline.html"

const PRECACHE = [
  "/offline.html",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(PRECACHE).catch(() => {})
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
          keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// Izinkan halaman meminta SW baru langsung aktif.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-icon.png" ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|gif|webp|ico)$/.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  // Hanya tangani permintaan same-origin. Supabase & pihak ketiga lewat langsung.
  if (url.origin !== self.location.origin) return

  // Jangan cache navigasi. Halaman utama bergantung pada sesi user dan query
  // Supabase; fallback offline hanya aman untuk halaman statis publik.
  if (req.mode === "navigate") {
    if (PUBLIC_NAVIGATION.has(url.pathname)) {
      event.respondWith(
        fetch(req).catch(async () => {
          const offline = await caches.match(OFFLINE_URL)
          return offline || new Response("Offline", { status: 503 })
        })
      )
    }
    return
  }

  // Aset statis: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      })()
    )
  }
})
