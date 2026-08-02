import { PurchasesView } from "@/components/purchases/purchases-view"

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const sp = await searchParams
  return <PurchasesView initialSupplierId={sp.supplier ?? null} />
}
