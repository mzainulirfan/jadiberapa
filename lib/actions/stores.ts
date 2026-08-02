"use server"

import { revalidatePath } from "next/cache"
import { isOwner } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { EMPTY_TEMPLATE_KEY } from "@/lib/templates"
import { applyStoreTemplate } from "@/lib/actions/templates"

export type DeleteStoreResult = {
  error: string | null
  deletedName?: string
  remaining?: number
  nextStoreId?: string | null
}

// Ekstrak path file di dalam bucket dari public URL Storage.
// Contoh URL: https://.../storage/v1/object/public/product-images/<uuid>.jpg
function storagePathFromUrl(url: string): string | null {
  const marker = "/product-images/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split("?")[0]
  return path || null
}

export async function deleteCurrentStore(confirmName: string): Promise<DeleteStoreResult> {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa menghapus toko" }
  const supabase = await createClient()

  // Kumpulkan gambar produk toko aktif sebelum data terhapus (RLS = toko aktif).
  const { data: products } = await supabase
    .from("products")
    .select("image_url")
    .not("image_url", "is", null)
  const imagePaths = (products ?? [])
    .map((p) => storagePathFromUrl(String(p.image_url)))
    .filter((p): p is string => Boolean(p))

  // Opsi A: hapus DB (RPC cascade) dulu, baru file. DB tetap konsisten bila
  // penghapusan file gagal (hanya menyisakan orphan storage).
  const { data, error } = await supabase.rpc("delete_current_store", { p_confirm: confirmName })
  if (error) return { error: error.message }
  const res =
    (data as {
      error?: string | null
      deleted_name?: string
      remaining?: number
      next_store_id?: string | null
    } | null) ?? { error: "Gagal menghapus toko" }
  if (res.error) return { error: res.error }

  if (imagePaths.length > 0) {
    const { error: removeErr } = await supabase.storage.from("product-images").remove(imagePaths)
    // Kegagalan hapus file tidak membatalkan; DB sudah konsisten.
    if (removeErr) console.warn("Gagal menghapus gambar produk:", removeErr.message)
  }

  revalidatePath("/dashboard")
  revalidatePath("/settings")
  return {
    error: null,
    deletedName: res.deleted_name,
    remaining: res.remaining,
    nextStoreId: res.next_store_id ?? null,
  }
}

export async function createStoreForCurrentUser(
  name: string,
  templateKey: string
): Promise<{ error: string | null; storeId?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_store_for_current_user", {
    p_name: name.trim(),
    p_code: null,
  })
  if (error) return { error: error.message }
  const res = (data as { error?: string | null; store_id?: string } | null) ?? {}
  if (res.error) return { error: res.error }

  if (templateKey && templateKey !== EMPTY_TEMPLATE_KEY) {
    const applied = await applyStoreTemplate(templateKey)
    if (applied.error) return { error: applied.error }
  }

  revalidatePath("/dashboard")
  return { error: null, storeId: res.store_id }
}
