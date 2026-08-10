import { OwnerGuard } from "@/components/auth/owner-guard"
import { PurchasesView } from "@/components/purchases/purchases-view"

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const sp = await searchParams
  return (
    <OwnerGuard>
      <PurchasesView initialSupplierId={sp.supplier ?? null} />
    </OwnerGuard>
  )
}
