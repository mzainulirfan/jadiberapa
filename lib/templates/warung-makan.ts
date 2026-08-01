import type { StoreTemplate } from "./types"

export const warungMakan: StoreTemplate = {
  key: "warung-makan",
  name: "Warung Makan",
  desc: "Masakan siap saji, lauk, sayur, minuman & bumbu dapur.",
  icon: "food",
  categories: ["Nasi & Olahan", "Lauk", "Sayur", "Minuman", "Bumbu"],
  products: [
    { name: "Nasi Putih", category: "Nasi & Olahan", price_buy: 3000, price_sell: 5000, stock: 100, unit: "porsi", sku: "NS-1" },
    { name: "Nasi Uduk", category: "Nasi & Olahan", price_buy: 4000, price_sell: 6000, stock: 50, unit: "porsi", sku: "NS-UDK" },
    { name: "Ayam Goreng", category: "Lauk", price_buy: 10000, price_sell: 15000, stock: 30, unit: "potong", sku: "AYM-GRG" },
    { name: "Ayam Bakar", category: "Lauk", price_buy: 11000, price_sell: 16000, stock: 25, unit: "potong", sku: "AYM-BKR" },
    { name: "Tempe Goreng", category: "Lauk", price_buy: 1500, price_sell: 3000, stock: 40, unit: "pcs", sku: "TMP-GRG" },
    { name: "Tahu Goreng", category: "Lauk", price_buy: 1500, price_sell: 3000, stock: 40, unit: "pcs", sku: "THU-GRG" },
    { name: "Telur Dadar", category: "Lauk", price_buy: 2000, price_sell: 4000, stock: 30, unit: "pcs", sku: "TLR-DDR" },
    { name: "Sayur Sop", category: "Sayur", price_buy: 3000, price_sell: 5000, stock: 20, unit: "porsi", sku: "SYR-SOP" },
    { name: "Tumis Kangkung", category: "Sayur", price_buy: 3000, price_sell: 5000, stock: 20, unit: "porsi", sku: "SYR-KNG" },
    { name: "Sambal Terasi", category: "Bumbu", price_buy: 2000, price_sell: 4000, stock: 30, unit: "porsi", sku: "SML-TRS" },
    { name: "Bawang Goreng", category: "Bumbu", price_buy: 5000, price_sell: 8000, stock: 15, unit: "bungkus", sku: "BWG-GRG" },
    { name: "Es Teh Manis", category: "Minuman", price_buy: 2000, price_sell: 5000, stock: 60, unit: "gelas", sku: "ES-TEH" },
    { name: "Es Jeruk", category: "Minuman", price_buy: 3000, price_sell: 7000, stock: 40, unit: "gelas", sku: "ES-JRK" },
    { name: "Teh Hangat", category: "Minuman", price_buy: 1500, price_sell: 3000, stock: 50, unit: "gelas", sku: "TH-HNG" },
    { name: "Kopi Hitam", category: "Minuman", price_buy: 2000, price_sell: 5000, stock: 40, unit: "gelas", sku: "KOP-HTM" },
    { name: "Air Mineral Gelas", category: "Minuman", price_buy: 1000, price_sell: 2000, stock: 200, unit: "gelas", sku: "AMM-GLS" },
  ],
  settings: { default_min_stock: "3" },
}
