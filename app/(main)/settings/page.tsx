import { OwnerGuard } from "@/components/auth/owner-guard"
import { SettingsForm } from "@/components/settings/settings-form"

export default function SettingsRoute() {
  return (
    <OwnerGuard>
      <SettingsForm />
    </OwnerGuard>
  )
}
