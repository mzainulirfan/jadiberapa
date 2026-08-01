export type TemplateProduct = {
  name: string
  category: string
  price_buy: number
  price_sell: number
  stock: number
  unit: string
  sku: string
}

export type TemplateDiscount = {
  name: string
  type: "product" | "category" | "global"
  value_type: "percent" | "amount"
  value: number
  active: boolean
  product_names?: string[]
}

export type StoreTemplate = {
  key: string
  name: string
  desc: string
  icon: "store" | "food" | "kiosk" | "home"
  categories: string[]
  products: TemplateProduct[]
  discounts?: TemplateDiscount[]
  settings?: Record<string, string>
}
