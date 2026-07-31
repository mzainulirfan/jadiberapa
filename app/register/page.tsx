import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 bg-canvas-soft">
      <div className="w-full max-w-sm">
        <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-1px] text-ink text-center mb-1">JadiBerapa</h1>
        <p className="text-center text-ink-muted mb-8">Buat akun baru</p>
        <RegisterForm />
        <p className="text-center text-sm text-ink-muted mt-4">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary font-medium">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
