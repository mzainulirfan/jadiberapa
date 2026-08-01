export type StoreTemplateOption = {
  key: string
  name: string
  desc: string
  icon: "store" | "food" | "kiosk" | "home" | "empty"
  productCount: number
}

export const EMPTY_TEMPLATE_KEY = "kosong"
export const PENDING_STORE_TEMPLATE_KEY = "pending_store_template"

export const storeTemplateOptions: StoreTemplateOption[] = [
  {
    key: "kelontong",
    name: "Toko Kelontong",
    desc: "Sembako, makanan pokok, minuman & kebutuhan rumah tangga.",
    icon: "store",
    productCount: 20,
  },
  {
    key: "warung-makan",
    name: "Warung Makan",
    desc: "Masakan siap saji, lauk, sayur, minuman & bumbu dapur.",
    icon: "food",
    productCount: 16,
  },
  {
    key: "kios",
    name: "Kios / Konter",
    desc: "Jajanan, minuman, rokok, pulsa, token & kebutuhan cepat.",
    icon: "kiosk",
    productCount: 15,
  },
  {
    key: "toserba",
    name: "Toserba / Perabot",
    desc: "Perabot rumah, alat dapur, kebersihan & elektronik kecil.",
    icon: "home",
    productCount: 15,
  },
  {
    key: EMPTY_TEMPLATE_KEY,
    name: "Mulai Kosong",
    desc: "Buat toko tanpa data contoh. Barang bisa ditambahkan manual.",
    icon: "empty",
    productCount: 0,
  },
]
