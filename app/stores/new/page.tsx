import { redirect } from "next/navigation"
import { AuthBrand } from "@/components/auth/auth-brand"
import { NewStoreForm } from "@/components/stores/new-store-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewStorePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Route ini hanya untuk user login yang belum punya toko aktif.
  const { data: storeId } = await supabase.rpc("current_store_id")
  if (storeId) redirect("/dashboard")

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-auto bg-canvas-soft">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 sm:px-6">
        <AuthBrand />
        <div className="rounded-[20px] border border-hairline bg-canvas p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6">
          <NewStoreForm />
        </div>
      </div>
    </div>
  )
}
