"use client"

import * as React from "react"
import { Trash } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const ACTION_W = 64 // lebar area hapus di kanan
const THRESHOLD = 40 // geser minimal untuk memicu hapus

// Baris item yang bisa digeser ke kiri untuk menghapus. Vertikal tetap
// menggulir normal (touch-action: pan-y); hanya geser horizontal yang dikelola.
export function SwipeToDelete({
  onDelete,
  disabled,
  className,
  children,
}: {
  onDelete: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [dx, setDx] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const startRef = React.useRef<{ x: number; dx: number } | null>(null)
  const dxRef = React.useRef(0)

  const applyDx = React.useCallback((v: number) => {
    dxRef.current = v
    setDx(v)
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    startRef.current = { x: e.clientX, dx: dxRef.current }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = startRef.current
    if (!s) return
    const ndx = Math.min(0, Math.max(-ACTION_W, s.dx + (e.clientX - s.x)))
    if (!dragging && Math.abs(ndx) > 2) setDragging(true)
    applyDx(ndx >= -ACTION_W ? ndx : dxRef.current)
  }

  function onPointerEnd() {
    const s = startRef.current
    startRef.current = null
    if (!s) {
      setDx(0)
      return
    }
    setDragging(false)
    if (dxRef.current <= -THRESHOLD) {
      onDelete()
    } else {
      applyDx(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex w-16 items-center bg-destructive">
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="flex h-full w-full items-center justify-center text-primary-foreground active:bg-destructive-fg"
          aria-label="Hapus"
        >
          <Trash className="size-5" />
        </button>
      </div>
      <div
        className={cn("relative touch-pan-y select-none", className)}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {children}
      </div>
    </div>
  )
}