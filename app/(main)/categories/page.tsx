import { OwnerGuard } from "@/components/auth/owner-guard"
import { CategoriesTab } from "@/components/more/categories-tab"

export default function CategoriesRoute() {
  return (
    <OwnerGuard>
      <div className="p-4">
        <CategoriesTab />
      </div>
    </OwnerGuard>
  )
}
