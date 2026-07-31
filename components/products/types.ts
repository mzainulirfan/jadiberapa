export type BxProduct = {
  id: string
  name: string
  category_id: string | null
  price_buy: number
  price_sell: number
  stock: number
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
