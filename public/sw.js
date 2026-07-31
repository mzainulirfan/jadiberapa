// Service worker Saberaha — cache app-shell agar tetap jalan saat offline.
// Strategi:
//  - Aset statis (_next/static, /icon, gambar) : cache-first + refresh di belakang.
//  - Navigasi halaman                          : network-first, fallback ke cache
//                                                 lalu ke /offline.html.
//  - Request lain (Supabase, POST, cross-origin): dibiarkan (network langsung).
// PENTING: jangan pernah cache request ke Supabase / non-GET / lintas-origin
// supaya auth, data realtime, dan penyimpanan transaksi tidak rusak.

const VERSION = "v1"
const STATIC_CACHE = `saberaha-static-${VERSION}`
const PAGE_CACHE = `saberaha-pages-${VERSION}`
const OFFLINE_URL = "/offline.html"

const PRECACHE = ["/offline.html", "/icon.svg", "/manifest.webmanifest"]

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
          .filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k))
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

  // Navigasi halaman: network-first dengan fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(PAGE_CACHE)
          cache.put(req, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(PAGE_CACHE)
          const cached = await cache.match(req)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          return (
            offline ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          )
        }
      })()
    )
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
