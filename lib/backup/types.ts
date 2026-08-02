export type BackupRow = Record<string, unknown> & {
  id?: string
  store_id?: string
  created_at?: string
  updated_at?: string
}

export type StoreBackupBundle = {
  meta: {
    exported_at: string
    app_version: string
    store_name: string
  }
  settings: Array<{ key: string; value: string }>
  categories: BackupRow[]
  products: BackupRow[]
  product_variants: BackupRow[]
  customers: BackupRow[]
  suppliers: BackupRow[]
  purchases: BackupRow[]
  purchase_items: BackupRow[]
  supplier_payments: BackupRow[]
  expenses: BackupRow[]
  discounts: BackupRow[]
  discount_products: Array<{ discount_id: string; product_id: string }>
  cash_sessions: BackupRow[]
  transactions: BackupRow[]
  transaction_items: BackupRow[]
  payments: BackupRow[]
  stock_movements: BackupRow[]
}

export type StoreBackupCounts = {
  settings: number
  categories: number
  products: number
  product_variants: number
  customers: number
  suppliers: number
  purchases: number
  purchase_items: number
  supplier_payments: number
  expenses: number
  discounts: number
  discount_products: number
  cash_sessions: number
  transactions: number
  transaction_items: number
  payments: number
  stock_movements: number
}
