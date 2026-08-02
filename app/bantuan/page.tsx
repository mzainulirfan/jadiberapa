import Link from "next/link"
import { AuthBrand } from "@/components/auth/auth-brand"
import { FaqView } from "@/components/faq/faq-view"

export default function BantuanPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-auto bg-canvas-soft">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6 sm:px-6">
        <AuthBrand />
        <FaqView />
        <p className="mt-2 text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-primary">
            Kembali ke Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
