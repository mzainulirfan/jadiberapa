"use client"

import { useEffect, useRef, useState } from "react"
import type { IScannerControls } from "@zxing/browser"
import { X, Zap } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDetect: (code: string) => void
  /** true = tetap memindai (kasir); false = tutup setelah satu barcode terbaca */
  continuous?: boolean
}

export function BarcodeScanner({ open, onOpenChange, onDetect, continuous = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastRef = useRef<{ code: string; time: number }>({ code: "", time: 0 })
  const onDetectRef = useRef(onDetect)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onDetectRef.current = onDetect
    onOpenChangeRef.current = onOpenChange
  })

  const [error, setError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return
    const videoEl = videoRef.current
    let cancelled = false
    let controls: IScannerControls | null = null

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const { DecodeHintType, BarcodeFormat } = await import("@zxing/library")
        const hints = new Map<number, unknown>()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ])
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanSuccess: 600 })
        if (!videoEl) return

        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoEl,
          (result) => {
            if (!result) return
            const code = result.getText()
            const now = Date.now()
            if (code === lastRef.current.code && now - lastRef.current.time < 1500) return
            lastRef.current = { code, time: now }
            navigator.vibrate?.(60)
            onDetectRef.current(code)
            if (!continuous) onOpenChangeRef.current(false)
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }

        const stream = videoEl.srcObject as MediaStream | null
        const track = stream?.getVideoTracks?.()[0]
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        setTorchSupported(!!caps?.torch)
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
      controls?.stop()
      const stream = videoEl?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      setTorchOn(false)
      setTorchSupported(false)
      setError(null)
    }
  }, [open, continuous, retry])

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject as MediaStream | null
    const track = stream?.getVideoTracks?.()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints)
      setTorchOn((v) => !v)
    } catch {
      setTorchSupported(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />
      {!error && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      )}

      <div className="relative z-10 flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <p className="text-base font-semibold text-white">Pindai Barcode</p>
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
        {error ? (
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
        ) : (
          <p className="mt-auto mb-2 text-center text-xs text-white/80">
            Arahkan kamera ke barcode
            {continuous ? " · scan beberapa barang berturut-turut" : ""}
          </p>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold active:opacity-80",
              torchOn ? "bg-white text-ink" : "bg-white/15 text-white"
            )}
          >
            <Zap className="size-4" /> Senter
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-10 items-center rounded-full bg-white px-6 text-sm font-semibold text-ink active:bg-white/85"
        >
          Selesai
        </button>
      </div>
    </div>
  )
}
