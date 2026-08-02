import Link from "next/link"
import { HelpCircle } from "@/components/ui/icons"

export function FaqLink() {
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-ink-muted">
      <HelpCircle className="size-4 text-ink-faint" />
      Butuh bantuan?{" "}
      <Link href="/bantuan" className="font-medium text-primary">
        Lihat FAQ
      </Link>
    </p>
  )
}
