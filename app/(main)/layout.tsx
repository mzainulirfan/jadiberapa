import { CartProvider } from "@/components/cart/cart-provider"
import { LockProvider } from "@/components/lock/screen-lock"
import { ViewportHeight } from "@/components/viewport-height/viewport-height"
import { NoStoreGuard } from "@/components/auth/no-store-guard"
import { CashierModeBanner, CashierModeProvider } from "@/components/auth/cashier-mode"
import { AppShell } from "@/components/app-shell/app-shell"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CashierModeProvider>
      <div
        className="flex flex-col"
        style={{ height: "var(--app-h, 100dvh)" }}
      >
        <ViewportHeight />
        <CartProvider>
          <CashierModeBanner />
          <NoStoreGuard>
            <LockProvider>
              <AppShell>{children}</AppShell>
            </LockProvider>
          </NoStoreGuard>
        </CartProvider>
      </div>
    </CashierModeProvider>
  )
}
