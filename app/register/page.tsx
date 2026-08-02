import Link from "next/link"
import { AuthBrand } from "@/components/auth/auth-brand"
import { RegisterForm } from "@/components/auth/register-form"
import { FaqLink } from "@/components/faq/faq-link"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; mode?: string }>
}) {
  const { code, mode } = await searchParams
  const registerMode = code || mode === "kasir" ? "kasir" : "owner"
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-auto bg-canvas-soft">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 sm:px-6">
        <AuthBrand />
        <div className="rounded-[20px] border border-hairline bg-canvas p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6">
          <RegisterForm mode={registerMode} initialCode={code} />
          <p className="mt-4 text-center text-sm text-ink-muted">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-primary">
              Masuk
            </Link>
          </p>
        </div>
        <FaqLink />
      </div>
    </div>
  )
}
