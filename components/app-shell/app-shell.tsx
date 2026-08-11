"use client"

import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { PullToRefresh } from "@/components/pull-to-refresh/pull-to-refresh"
import { Header } from "@/components/header/header"
import { BottomNav } from "@/components/bottom-nav/bottom-nav"
import { Sidebar } from "./sidebar"
import { DesktopHeader } from "./desktop-header"
import { DesktopContent } from "./desktop-content"

// Shell responsif: satu `{children}` yang dibungkus satu scroller dengan layout
// adaptif via CSS breakpoint. Mobile (<1024px) mempertahankan Header +
// PullToRefresh + BottomNav; desktop (>=1024px) memakai Sidebar + DesktopHeader
// dan content scroller biasa (pull-to-refresh dinonaktifkan).
export function AppShell({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  return (
    <div className="flex h-full">
      <Sidebar className="hidden lg:flex lg:w-56 xl:w-[248px]" />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DesktopHeader className="hidden lg:flex" />

        <div className="lg:hidden">
          <Header />
        </div>

        <PullToRefresh disabled={isDesktop} className="flex-1">
          <DesktopContent>{children}</DesktopContent>
        </PullToRefresh>

        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}