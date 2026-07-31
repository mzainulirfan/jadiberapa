import { BottomNav } from "@/components/bottom-nav/bottom-nav"
import { CartProvider } from "@/components/cart/cart-provider"
import { Header } from "@/components/header/header"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col">
      <CartProvider>
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <BottomNav />
      </CartProvider>
    </div>
  )
}
