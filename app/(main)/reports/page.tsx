import { OwnerGuard } from "@/components/auth/owner-guard"
import { ReportsView } from "@/components/reports/reports-view"

export default function ReportsRoute() {
  return (
    <OwnerGuard>
      <ReportsView />
    </OwnerGuard>
  )
}
