"use client"

import * as React from "react"
import { toast } from "sonner"

// Mendaftarkan service worker (hanya di produksi agar tidak mengganggu HMR dev),
// menampilkan indikator saat offline, dan menawarkan reload ketika ada versi baru.
export function ServiceWorkerRegister() {
  const [offline, setOffline] = React.useState(false)

  React.useEffect(() => {
    // Status koneksi.
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)

    let cleanupSw: (() => void) | undefined

    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      const onControllerChange = () => window.location.reload()

      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          // Deteksi service worker baru yang siap menggantikan.
          reg.addEventListener("updatefound", () => {
            const sw = reg.installing
            if (!sw) return
            sw.addEventListener("statechange", () => {
              if (sw.state === "installed" && navigator.serviceWorker.controller) {
                toast("Versi baru tersedia", {
                  description: "Muat ulang untuk memakai versi terbaru.",
                  duration: Infinity,
                  action: {
                    label: "Muat ulang",
                    onClick: () => sw.postMessage("SKIP_WAITING"),
                  },
                })
              }
            })
          })
        })
        .catch(() => {
          // Registrasi gagal — abaikan, app tetap jalan online.
        })

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange
      )
      cleanupSw = () =>
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange
        )
    }

    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      cleanupSw?.()
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm"
    >
      Tidak ada koneksi internet
    </div>
  )
}
