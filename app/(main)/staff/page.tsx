import { OwnerGuard } from "@/components/auth/owner-guard"
import { StaffView } from "@/components/staff/staff-view"

export default function StaffRoute() {
  return (
    <OwnerGuard>
      <StaffView />
    </OwnerGuard>
  )
}
