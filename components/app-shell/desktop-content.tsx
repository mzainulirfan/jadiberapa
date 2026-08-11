"use client"

import { usePathname } from "next/navigation"
import { CONTENT_WIDTHS, resolveRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

// Pembungkus konten: mempertahankan rantai tinggi (h-full) halaman ber-scroll
// internal (Kasir/Cart) lalu menengahkan & membatasi lebar sesuai variant pada
// desktop. Halaman tanpa scroll internal otomatis menggulir di scroller shell.
export function DesktopContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { contentWidth } = resolveRoute(pathname)
  return (
    <div className={cn("mx-auto h-full w-full", CONTENT_WIDTHS[contentWidth])}>
      {children}
    </div>
  )
}