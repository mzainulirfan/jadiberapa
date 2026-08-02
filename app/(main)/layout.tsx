import { BottomNav } from "@/components/bottom-nav/bottom-nav"
import { CartProvider } from "@/components/cart/cart-provider"
import { Header } from "@/components/header/header"
import { PullToRefresh } from "@/components/pull-to-refresh/pull-to-refresh"
import { ViewportHeight } from "@/components/viewport-height/viewport-height"
import { NoStoreGuard } from "@/components/auth/no-store-guard"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NoStoreGuard>
      <div
        className="flex flex-col"
        style={{ height: "var(--app-h, 100dvh)" }}
      >
        <ViewportHeight />
        <CartProvider>
          <Header />
          <PullToRefresh className="flex-1">{children}</PullToRefresh>
          <BottomNav />
        </CartProvider>
      </div>
    </NoStoreGuard>
  )
}
