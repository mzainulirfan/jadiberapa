"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ProductSort = "name-asc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc"

const PAGE_SIZE = 20

export async function getProducts(search?: string, categoryIds?: string[], limit?: number) {
  const supabase = await createClient()
  let query = supabase.from("products").select("*, categories(name)").order("name")

  if (search) {
    const s = search.trim()
    if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  }
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)
  if (limit) query = query.limit(limit)

  const { data } = await query
  return data ?? []
}

export async function getProductsPage(params: {
  search?: string
  categoryIds?: string[]
  sort?: ProductSort
  page?: number
  pageSize?: number
}) {
  const supabase = await createClient()
  const { search, categoryIds, sort = "name-asc", page = 0, pageSize = PAGE_SIZE } = params

  let query = supabase
    .from("products")
    .select("*, categories(name)", { count: "exact" })

  const s = search?.trim()
  if (s) query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`)
  if (categoryIds && categoryIds.length > 0) query = query.in("category_id", categoryIds)

  switch (sort) {
    case "price-asc":
      query = query.order("price_sell", { ascending: true })
      break
    case "price-desc":
      query = query.order("price_sell", { ascending: false })
      break
    case "stock-asc":
      query = query.order("stock", { ascending: true })
      break
    case "stock-desc":
      query = query.order("stock", { ascending: false })
      break
    default:
      query = query.order("name", { ascending: true })
  }

  const { data, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  return { data: data ?? [], total: count ?? 0 }
}

export async function uploadProductImage(formData: FormData) {
  const file = formData.get("file") as File | null
  if (!file) return { url: null, error: "Tidak ada file" }
  if (!file.type.startsWith("image/")) return { url: null, error: "File harus berupa gambar" }

  const supabase = await createClient()
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function getProduct(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("products").select("*, categories(name)").eq("id", id).single()
  return data
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData) as Record<string, string>

  const { error } = await supabase.from("products").insert({
    name: raw.name,
    category_id: raw.category_id || null,
    price_buy: Number(raw.price_buy) || 0,
    price_sell: Number(raw.price_sell) || 0,
    stock: Number(raw.stock) || 0,
    sku: raw.sku || null,
    barcode: raw.barcode || null,
    image_url: raw.image_url || null,
  })

  if (error) return { error: error.message }
  revalidatePath("/products")
  return { error: null }
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData) as Record<string, string>

  const { error } = await supabase.from("products").update({
    name: raw.name,
    category_id: raw.category_id || null,
    price_buy: Number(raw.price_buy) || 0,
    price_sell: Number(raw.price_sell) || 0,
    stock: Number(raw.stock) || 0,
    sku: raw.sku || null,
    barcode: raw.barcode || null,
    image_url: raw.image_url || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/products")
  return { error: null }
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/products")
  return { error: null }
}

export async function createCategory(name: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("categories").insert({ name }).select().single()
  if (error) return { error: error.message, data: null }
  revalidatePath("/more")
  return { error: null, data }
}

export async function getCategories() {
  const supabase = await createClient()
  const { data } = await supabase.from("categories").select("*").order("name")
  return data ?? []
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/more")
  return { error: null }
}

export async function updateCategory(id: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("categories").update({ name }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/more")
  return { error: null }
}
