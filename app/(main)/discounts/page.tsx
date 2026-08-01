import { OwnerGuard } from "@/components/auth/owner-guard"
import { DiscountsView } from "@/components/discounts/discounts-view"

export default function DiscountsPage() {
  return (
    <OwnerGuard>
      <DiscountsView />
    </OwnerGuard>
  )
}
