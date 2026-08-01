import { OwnerGuard } from "@/components/auth/owner-guard"
import { BackupView } from "@/components/backup/backup-view"

export default function BackupPage() {
  return (
    <OwnerGuard>
      <BackupView />
    </OwnerGuard>
  )
}
