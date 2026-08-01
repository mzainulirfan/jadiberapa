import { OwnerGuard } from "@/components/auth/owner-guard"
import { DemoDataView } from "@/components/demo-data/demo-data-view"

export default function DemoDataPage() {
  return (
    <OwnerGuard>
      <DemoDataView />
    </OwnerGuard>
  )
}
