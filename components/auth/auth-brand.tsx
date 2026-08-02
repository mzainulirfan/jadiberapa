import Image from "next/image"
import Link from "next/link"

export function AuthBrand() {
  return (
    <Link href="/" className="mb-5 flex items-center gap-3 self-center">
      <Image
        src="/icon.svg"
        alt="Logo Saberaha"
        width={44}
        height={44}
        priority
        className="rounded-xl"
      />
      <span>
        <span className="block text-lg font-bold tracking-tight text-ink">Saberaha</span>
        <span className="block text-xs text-ink-muted">Kasir warung & UMKM</span>
      </span>
    </Link>
  )
}
