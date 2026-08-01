import type { StoreTemplate } from "./types"

export const kios: StoreTemplate = {
  key: "kios",
  name: "Kios / Konter",
  desc: "Jajanan, minuman, rokok, pulsa, token & kebutuhan cepat.",
  icon: "kiosk",
  categories: ["Makanan", "Minuman", "Rokok", "Pulsa & Token", "Kebutuhan Harian"],
  products: [
    { name: "Air Mineral 600ml", category: "Minuman", price_buy: 3000, price_sell: 4000, stock: 60, unit: "botol", sku: "AMM-600" },
    { name: "Teh Botol 350ml", category: "Minuman", price_buy: 3500, price_sell: 5000, stock: 40, unit: "botol", sku: "THB-350" },
    { name: "Kopi Kaleng", category: "Minuman", price_buy: 6500, price_sell: 8500, stock: 30, unit: "kaleng", sku: "KOP-KLG" },
    { name: "Minuman Isotonik", category: "Minuman", price_buy: 5500, price_sell: 7500, stock: 30, unit: "botol", sku: "ISO-1" },
    { name: "Keripik Singkong", category: "Makanan", price_buy: 5000, price_sell: 7000, stock: 40, unit: "bungkus", sku: "KRP-SKG" },
    { name: "Wafer Cokelat", category: "Makanan", price_buy: 2500, price_sell: 4000, stock: 50, unit: "pcs", sku: "WFR-CKT" },
    { name: "Permen Mint", category: "Makanan", price_buy: 5000, price_sell: 7000, stock: 25, unit: "pack", sku: "PRM-MNT" },
    { name: "Mi Instan Goreng", category: "Makanan", price_buy: 2500, price_sell: 3500, stock: 80, unit: "pcs", sku: "MIG-1" },
    { name: "Rokok Filter", category: "Rokok", price_buy: 25000, price_sell: 28000, stock: 20, unit: "bungkus", sku: "RK-FLT" },
    { name: "Rokok Mild", category: "Rokok", price_buy: 28000, price_sell: 31000, stock: 20, unit: "bungkus", sku: "RK-MLD" },
    { name: "Pulsa 10.000", category: "Pulsa & Token", price_buy: 10500, price_sell: 12000, stock: 100, unit: "trx", sku: "PLS-10" },
    { name: "Pulsa 25.000", category: "Pulsa & Token", price_buy: 25500, price_sell: 28000, stock: 100, unit: "trx", sku: "PLS-25" },
    { name: "Token Listrik 20.000", category: "Pulsa & Token", price_buy: 20000, price_sell: 22500, stock: 100, unit: "trx", sku: "TKN-20" },
    { name: "Masker Medis", category: "Kebutuhan Harian", price_buy: 1000, price_sell: 2000, stock: 50, unit: "pcs", sku: "MSK-1" },
    { name: "Tisu Wajah", category: "Kebutuhan Harian", price_buy: 6500, price_sell: 9000, stock: 20, unit: "pack", sku: "TSU-WJH" },
  ],
  settings: { default_min_stock: "10" },
}
