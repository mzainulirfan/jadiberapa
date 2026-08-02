import Link from "next/link"
import { AuthBrand } from "@/components/auth/auth-brand"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-auto bg-canvas-soft">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 sm:px-6">
        <AuthBrand />
        <div className="rounded-[20px] border border-hairline bg-canvas p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="mb-5 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Masuk ke akun</h1>
            <p className="text-sm text-ink-muted">Lanjutkan mengelola toko Anda.</p>
          </div>
          <LoginForm />
          <p className="mt-4 text-center text-sm text-ink-muted">
            Belum punya akun?{" "}
            <Link href="/register" className="font-medium text-primary">
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
