import { CategoriesTab } from "@/components/more/categories-tab"

export default function CategoriesRoute() {
  return (
    <div className="p-4">
      <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">Kategori</h1>
      <p className="text-ink-muted text-sm mb-4">Kelola kategori barang</p>
      <CategoriesTab />
    </div>
  )
}
