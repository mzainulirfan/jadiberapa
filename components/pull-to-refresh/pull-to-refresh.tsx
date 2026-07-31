"use client"

import * as React from "react"
import { Refresh } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const THRESHOLD = 72 // jarak tarik (px) untuk memicu refresh
const MAX = 110 // batas tarik agar tidak melar berlebihan
const RESISTANCE = 0.5 // hambatan agar tarikan terasa natural

// Pull-to-refresh custom untuk area <main> yang menggulir. Diperlukan karena
// app-shell mengunci html/body (overflow hidden, overscroll-behavior none) &
// scroll terjadi di nested scroller, sehingga PTR bawaan browser tak aktif.
export function PullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [pull, setPull] = React.useState(0)
  const [refreshing, setRefreshing] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)

  // Ref agar handler native (deps kosong) selalu baca nilai terkini tanpa re-bind.
  const pullRef = React.useRef(0)
  const refreshingRef = React.useRef(false)
  const startYRef = React.useRef(0)
  const activeRef = React.useRef(false)
  const pullingRef = React.useRef(false)
  // Scroller efektif di bawah sentuhan (bisa nested), bukan selalu <main>.
  const scrollerRef = React.useRef<HTMLElement | null>(null)

  const applyPull = React.useCallback((v: number) => {
    pullRef.current = v
    setPull(v)
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // Telusuri ancestor untuk menemukan scroller yang benar-benar bisa digulir.
    function findScroller(target: EventTarget | null): HTMLElement {
      let node = target as HTMLElement | null
      while (node && node !== el && el!.contains(node)) {
        const oy = getComputedStyle(node).overflowY
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
          return node
        }
        node = node.parentElement
      }
      return el!
    }

    function onStart(e: TouchEvent) {
      if (refreshingRef.current) return
      if (e.touches.length !== 1) {
        activeRef.current = false
        return
      }
      const scroller = findScroller(e.target)
      scrollerRef.current = scroller
      // Hanya aktif bila scroller efektif sudah di paling atas.
      if (scroller.scrollTop > 0) {
        activeRef.current = false
        return
      }
      activeRef.current = true
      pullingRef.current = false
      startYRef.current = e.touches[0].clientY
    }

    function onMove(e: TouchEvent) {
      if (!activeRef.current || refreshingRef.current) return
      const scroller = scrollerRef.current ?? el!
      const dy = e.touches[0].clientY - startYRef.current
      // Tarik ke atas atau scroller sudah tergulir → batalkan.
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (pullingRef.current) {
          pullingRef.current = false
          setDragging(false)
          applyPull(0)
        }
        if (scroller.scrollTop > 0) activeRef.current = false
        return
      }
      pullingRef.current = true
      setDragging(true)
      // Cegah scroll/overscroll bawaan agar gesture jadi pull-to-refresh.
      e.preventDefault()
      applyPull(Math.min(MAX, dy * RESISTANCE))
    }

    function onEnd() {
      if (!activeRef.current) return
      activeRef.current = false
      setDragging(false)
      if (pullingRef.current && pullRef.current >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        applyPull(56)
        // Jeda singkat agar indikator terlihat sebelum reload penuh.
        window.setTimeout(() => window.location.reload(), 150)
      } else {
        applyPull(0)
      }
      pullingRef.current = false
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onEnd)
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [applyPull])

  const eased = !dragging
  const progress = Math.min(1, pull / THRESHOLD)

  return (
    <main
      ref={scrollRef}
      className={cn("relative overflow-y-auto overscroll-y-contain", className)}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
        <span
          className="flex size-9 items-center justify-center rounded-full border border-hairline bg-canvas shadow-sm"
          style={{
            transform: `translateY(${pull - 46}px)`,
            opacity: progress,
            transition: eased ? "transform 0.2s ease, opacity 0.2s ease" : "none",
          }}
        >
          <Refresh
            className={cn("size-4 text-ink-muted", refreshing && "animate-spin")}
            style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          />
        </span>
      </div>
      <div
        className="h-full"
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: eased ? "transform 0.2s ease" : "none",
        }}
      >
        {children}
      </div>
    </main>
  )
}
