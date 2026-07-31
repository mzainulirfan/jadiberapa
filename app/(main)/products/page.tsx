import { Suspense } from "react"
import { ProductList } from "@/components/products/product-list"

export default function ProductsPage() {
  return (
    <div>
      <div className="p-4 pb-0">
        <h1 className="text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-ink mb-1">Barang</h1>
        <p className="text-ink-muted text-sm">Daftar dan kelola barang</p>
      </div>
      <ProductList />
    </div>
  )
}
