"use client"

import { useEffect, useState } from "react"
import { Download } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Tombol "Pasang Aplikasi" untuk Android Chrome. Hanya muncul ketika browser
// benar-benar menawarkan instalasi (event beforeinstallprompt) dan aplikasi
// belum berjalan sebagai PWA standalone. Di iOS event ini tidak ada, jadi
// tombol otomatis tersembunyi (iOS memakai "Tambahkan ke Layar Utama").
export function PwaInstallButton({ className }: { className?: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallEvent(null)

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (!installEvent) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent.prompt()
        const choice = await installEvent.userChoice
        if (choice.outcome === "accepted") setInstallEvent(null)
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5 text-left transition-colors active:bg-primary/10",
        className
      )}
    >
      <Download className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">Pasang Aplikasi</p>
        <p className="text-xs text-ink-faint">Akses cepat dari layar utama HP</p>
      </div>
    </button>
  )
}
