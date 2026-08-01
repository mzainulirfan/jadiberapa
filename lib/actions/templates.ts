"use server"

import { revalidatePath } from "next/cache"
import { isOwner } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { EMPTY_TEMPLATE_KEY, getStoreTemplate } from "@/lib/templates"

async function currentStoreId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("current_store_id")
  if (error) return { storeId: null, error: error.message }
  return { storeId: data as string | null, error: null }
}

async function hasStarterData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ count: productCount, error: productErr }, { count: categoryCount, error: categoryErr }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
  ])
  if (productErr) return { hasData: true, error: productErr.message }
  if (categoryErr) return { hasData: true, error: categoryErr.message }
  return { hasData: (productCount ?? 0) > 0 || (categoryCount ?? 0) > 0, error: null }
}

function revalidateTemplatePaths() {
  revalidatePath("/dashboard")
  revalidatePath("/products")
  revalidatePath("/categories")
  revalidatePath("/discounts")
  revalidatePath("/more")
}

export async function skipStoreTemplate() {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa melewati template" }
  const supabase = await createClient()
  const { storeId, error } = await currentStoreId(supabase)
  if (error) return { error }
  if (!storeId) return { error: "Toko aktif tidak ditemukan" }

  const { error: updateErr } = await supabase
    .from("stores")
    .update({ template_key: EMPTY_TEMPLATE_KEY })
    .eq("id", storeId)
  if (updateErr) return { error: updateErr.message }
  revalidateTemplatePaths()
  return { error: null }
}

export async function applyStoreTemplate(templateKey: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa menerapkan template" }
  if (templateKey === EMPTY_TEMPLATE_KEY) return skipStoreTemplate()

  const template = getStoreTemplate(templateKey)
  if (!template) return { error: "Template tidak ditemukan" }

  const supabase = await createClient()
  const { storeId, error } = await currentStoreId(supabase)
  if (error) return { error }
  if (!storeId) return { error: "Toko aktif tidak ditemukan" }

  const starter = await hasStarterData(supabase)
  if (starter.error) return { error: starter.error }
  if (starter.hasData) return { error: "Toko sudah memiliki barang atau kategori" }

  const categoryRows = template.categories.map((name) => ({ store_id: storeId, name }))
  const { error: categoryErr } = await supabase
    .from("categories")
    .upsert(categoryRows, { onConflict: "store_id,name", ignoreDuplicates: true })
  if (categoryErr) return { error: categoryErr.message }

  const { data: categories, error: readCategoryErr } = await supabase
    .from("categories")
    .select("id, name")
    .in("name", template.categories)
  if (readCategoryErr) return { error: readCategoryErr.message }

  const categoryByName = new Map((categories ?? []).map((c) => [c.name as string, c.id as string]))
  const defaultMinStock = Number(template.settings?.default_min_stock ?? 0) || 0

  const productRows = template.products.map((p) => ({
    store_id: storeId,
    name: p.name,
    category_id: categoryByName.get(p.category) ?? null,
    price_buy: p.price_buy,
    price_sell: p.price_sell,
    stock: p.stock,
    min_stock: defaultMinStock,
    unit: p.unit,
    sku: p.sku,
    barcode: null,
    image_url: null,
    is_favorite: false,
  }))

  const { data: products, error: productErr } = await supabase
    .from("products")
    .insert(productRows)
    .select("id, name")
  if (productErr) return { error: productErr.message }

  const productByName = new Map((products ?? []).map((p) => [p.name as string, p.id as string]))

  for (const discount of template.discounts ?? []) {
    const { data: rule, error: discountErr } = await supabase
      .from("discounts")
      .insert({
        store_id: storeId,
        name: discount.name,
        type: discount.type,
        value_type: discount.value_type,
        value: discount.value,
        active: discount.active,
      })
      .select("id")
      .single()
    if (discountErr) return { error: discountErr.message }

    const links = (discount.product_names ?? [])
      .map((name) => productByName.get(name))
      .filter(Boolean)
      .map((productId) => ({ store_id: storeId, discount_id: rule.id as string, product_id: productId as string }))
    if (links.length > 0) {
      const { error: linkErr } = await supabase.from("discount_products").insert(links)
      if (linkErr) return { error: linkErr.message }
    }
  }

  if (template.settings) {
    const keys = Object.keys(template.settings)
    const { data: existingSettings, error: settingsReadErr } = await supabase
      .from("settings")
      .select("key")
      .in("key", keys)
    if (settingsReadErr) return { error: settingsReadErr.message }
    const existing = new Set((existingSettings ?? []).map((s) => s.key as string))
    const settingsRows = Object.entries(template.settings)
      .filter(([key]) => !existing.has(key))
      .map(([key, value]) => ({ store_id: storeId, key, value }))
    if (settingsRows.length > 0) {
      const { error: settingsErr } = await supabase.from("settings").insert(settingsRows)
      if (settingsErr) return { error: settingsErr.message }
    }
  }

  const { error: updateErr } = await supabase
    .from("stores")
    .update({ template_key: template.key })
    .eq("id", storeId)
  if (updateErr) return { error: updateErr.message }

  revalidateTemplatePaths()
  return { error: null }
}
