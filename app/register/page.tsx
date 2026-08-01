import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"
import { Receipt, ShoppingBag, Store, Tag } from "@/components/ui/icons"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  return (
    <div className="flex flex-1 overflow-y-auto bg-canvas-soft">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-6 sm:px-6">
        <div className="mb-5 space-y-4">
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.125px] text-ink-muted">
            <span className="rounded-full border border-hairline bg-canvas px-2.5 py-1">Mobile POS UMKM</span>
            <span className="rounded-full border border-hairline bg-canvas px-2.5 py-1">Template toko</span>
            <span className="rounded-full border border-hairline bg-canvas px-2.5 py-1">Kasir cepat</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-[-1px] text-ink sm:text-[40px]">
              Buka toko digital dalam menit
            </h1>
            <p className="max-w-sm text-sm text-ink-muted">
              Pilih template, buat akun, dan mulai jualan tanpa setup yang ribet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-ink-muted sm:grid-cols-4">
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-canvas px-3 py-2.5">
              <Store className="size-4 text-primary" />
              <span>Toko</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-canvas px-3 py-2.5">
              <ShoppingBag className="size-4 text-accent-teal" />
              <span>Barang</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-canvas px-3 py-2.5">
              <Receipt className="size-4 text-accent-orange" />
              <span>Struk</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-canvas px-3 py-2.5">
              <Tag className="size-4 text-accent-purple" />
              <span>Template</span>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-hairline bg-canvas p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6">
          <RegisterForm initialCode={code} />
          <p className="mt-4 text-center text-sm text-ink-muted">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-primary">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
