import { OwnerGuard } from "@/components/auth/owner-guard"
import { PurchaseDetail } from "@/components/purchases/purchase-detail"

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <OwnerGuard>
      <PurchaseDetail id={id} />
    </OwnerGuard>
  )
}
