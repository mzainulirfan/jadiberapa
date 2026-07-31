import { BottomNav } from "@/components/bottom-nav/bottom-nav"
import { CartProvider } from "@/components/cart/cart-provider"
import { Header } from "@/components/header/header"
import { PullToRefresh } from "@/components/pull-to-refresh/pull-to-refresh"
import { ViewportHeight } from "@/components/viewport-height/viewport-height"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
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
  )
}
