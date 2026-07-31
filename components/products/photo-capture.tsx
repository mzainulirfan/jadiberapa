"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Camera } from "@/components/ui/icons"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCapture: (file: File) => void
}

// Kamera in-app via getUserMedia — dibutuhkan di desktop, karena atribut
// <input capture> hanya membuka kamera di perangkat mobile (di desktop diabaikan
// dan jatuh ke file explorer).
export function PhotoCapture({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return
    const videoEl = videoRef.current
    let cancelled = false

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoEl) {
          videoEl.srcObject = stream
          await videoEl.play().catch(() => {})
        }
        setReady(true)
      } catch (e) {
        if (cancelled) return
        const name = (e as { name?: string })?.name
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan akses kamera lalu coba lagi."
            : name === "NotFoundError"
              ? "Kamera tidak ditemukan pada perangkat ini."
              : "Gagal memulai kamera."
        )
      }
    })()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setReady(false)
      setError(null)
    }
  }, [open, retry])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }))
        onOpenChange(false)
      },
      "image/jpeg",
      0.92
    )
  }

  if (!open || typeof document === "undefined") return null

  // Diportal ke <body> dgn z-[70] agar tampil di atas Drawer/Dialog (z-50).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* object-contain agar pratinjau = hasil (WYSIWYG), tidak terpotong. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 size-full object-contain"
      />

      <div className="relative z-10 flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <p className="text-base font-semibold text-white">Ambil Foto</p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full bg-white/15 p-2 text-white active:bg-white/25"
          aria-label="Tutup"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {error && (
          <div className="w-full max-w-xs rounded-2xl bg-canvas p-5 text-center">
            <p className="text-sm text-ink">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setRetry((r) => r + 1)
              }}
              className="mt-4 h-9 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground active:bg-primary-active"
            >
              Coba lagi
            </button>
          </div>
        )}
      </div>

      {!error && (
        <div className="relative z-10 flex items-center justify-center p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="flex size-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 text-white transition-transform active:scale-95 disabled:opacity-40"
            aria-label="Ambil foto"
          >
            <Camera className="size-7" />
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
