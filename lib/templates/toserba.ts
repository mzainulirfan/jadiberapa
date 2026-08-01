import type { StoreTemplate } from "./types"

export const toserba: StoreTemplate = {
  key: "toserba",
  name: "Toserba / Perabot",
  desc: "Perabot rumah, alat dapur, kebersihan & elektronik kecil.",
  icon: "home",
  categories: ["Perabot", "Alat Dapur", "Kebersihan", "Elektronik Kecil", "Perawatan Diri"],
  products: [
    { name: "Ember Plastik", category: "Perabot", price_buy: 12000, price_sell: 18000, stock: 20, unit: "pcs", sku: "EMB-1" },
    { name: "Gayung", category: "Perabot", price_buy: 5000, price_sell: 8000, stock: 30, unit: "pcs", sku: "GYG-1" },
    { name: "Keranjang Serbaguna", category: "Perabot", price_buy: 14000, price_sell: 21000, stock: 15, unit: "pcs", sku: "KRJ-1" },
    { name: "Panci 20cm", category: "Alat Dapur", price_buy: 45000, price_sell: 60000, stock: 10, unit: "pcs", sku: "PNC-20" },
    { name: "Wajan 24cm", category: "Alat Dapur", price_buy: 50000, price_sell: 68000, stock: 10, unit: "pcs", sku: "WJN-24" },
    { name: "Pisau Dapur", category: "Alat Dapur", price_buy: 12000, price_sell: 18000, stock: 20, unit: "pcs", sku: "PSU-DPR" },
    { name: "Sapu Ijuk", category: "Kebersihan", price_buy: 13000, price_sell: 20000, stock: 20, unit: "pcs", sku: "SPU-IJK" },
    { name: "Pel Lantai", category: "Kebersihan", price_buy: 18000, price_sell: 27000, stock: 15, unit: "pcs", sku: "PEL-1" },
    { name: "Sabun Cuci Piring", category: "Kebersihan", price_buy: 9000, price_sell: 12500, stock: 25, unit: "botol", sku: "SCP-1" },
    { name: "Lampu LED 9W", category: "Elektronik Kecil", price_buy: 16000, price_sell: 24000, stock: 20, unit: "pcs", sku: "LED-9" },
    { name: "Kabel Roll 3m", category: "Elektronik Kecil", price_buy: 35000, price_sell: 50000, stock: 8, unit: "pcs", sku: "KBL-3" },
    { name: "Baterai AA", category: "Elektronik Kecil", price_buy: 7000, price_sell: 10000, stock: 30, unit: "pack", sku: "BTR-AA" },
    { name: "Sabun Mandi", category: "Perawatan Diri", price_buy: 3500, price_sell: 5000, stock: 40, unit: "pcs", sku: "SBM-1" },
    { name: "Shampoo Botol", category: "Perawatan Diri", price_buy: 16000, price_sell: 22000, stock: 15, unit: "botol", sku: "SHP-BTL" },
    { name: "Pasta Gigi", category: "Perawatan Diri", price_buy: 9000, price_sell: 12000, stock: 20, unit: "pcs", sku: "PGG-1" },
  ],
  settings: { default_min_stock: "3" },
}
