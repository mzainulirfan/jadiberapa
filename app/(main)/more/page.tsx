import Link from "next/link"
import {
  User as UserIcon,
  BarChart,
  Tag,
  Cog,
  ChevronRight,
} from "@/components/ui/icons"

const menu = [
  { href: "/customers", label: "Pembeli", desc: "Daftar dan kelola pembeli", icon: UserIcon },
  { href: "/reports", label: "Laporan", desc: "Laporan penjualan", icon: BarChart },
  { href: "/categories", label: "Kategori", desc: "Kelola kategori barang", icon: Tag },
  { href: "/settings", label: "Pengaturan", desc: "Pengaturan toko", icon: Cog },
]

export default function MorePage() {
  return (
    <div className="p-4">
      <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-4">Lainnya</h1>
      <div className="rounded-xl bg-canvas border border-hairline divide-y divide-hairline">
        {menu.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-3.5 active:bg-canvas-soft transition-colors"
            >
              <Icon className="size-5 text-ink-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-ink-faint">{item.desc}</p>
              </div>
              <ChevronRight className="size-4 text-ink-faint" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

