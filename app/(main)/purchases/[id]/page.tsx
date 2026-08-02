import { PurchaseDetail } from "@/components/purchases/purchase-detail"

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PurchaseDetail id={id} />
}
