import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6 bg-canvas-soft">
      <div className="my-auto w-full max-w-sm">
        <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-1px] text-ink text-center mb-1">JadiBerapa</h1>
        <p className="text-center text-ink-muted mb-8">Masuk ke kasir</p>
        <LoginForm />
        <p className="text-center text-sm text-ink-muted mt-4">
          Belum punya akun?{" "}
          <Link href="/register" className="text-primary font-medium">Daftar</Link>
        </p>
      </div>
    </div>
  )
}
