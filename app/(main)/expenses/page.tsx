import { OwnerGuard } from "@/components/auth/owner-guard"
import { ExpensesView } from "@/components/expenses/expenses-view"

export default function ExpensesPage() {
  return (
    <OwnerGuard>
      <ExpensesView />
    </OwnerGuard>
  )
}
