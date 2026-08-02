export type BxProduct = {
  id: string
  name: string
  category_id: string | null
  price_buy: number
  price_sell: number
  stock: number
  min_stock: number
  is_favorite: boolean
  unit: string | null
  sku: string | null
  barcode: string | null
  image_url: string | null
  created_at: string
  updated_at: string
  categories: { name: string } | null
}

export type BxCategory = {
  id: string
  name: string
}

export type BxVariant = {
  id: string
  product_id: string
  name: string
  sku: string | null
  price_buy: number
  price_sell: number
}

// Satuan turunan (bulk/eceran) dari satu produk, mis. 1 dus = 12 pcs.
// `factor` = berapa satuan dasar (products.unit) per satuan ini.
export type BxProductUnit = {
  id: string
  product_id: string
  name: string
  factor: number
  price_sell: number
}
