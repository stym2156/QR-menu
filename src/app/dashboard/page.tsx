import { redirect } from "next/navigation";
import { getDashboardSummary } from "@/features/dashboard/queries";
import { requireDashboardSession } from "@/server/auth";
import DashboardCards from "./DashboardCards";

export default async function DashboardPage() {
  const { supabase, membership } = await requireDashboardSession();

  // Non-owners land on their primary work page instead of the owner dashboard.
  if (membership.role === "cook" || membership.role === "staff") {
    redirect("/dashboard/kitchen");
  }
  if (membership.role === "waiter") {
    redirect("/dashboard/bills");
  }

  const summary = await getDashboardSummary(supabase, membership.restaurantId);

  return (
    <DashboardCards
      todayRevenue={summary.todayRevenue}
      todayPaidCount={summary.todayPaidCount}
      pendingCount={summary.pendingCount}
      unpaidTableCount={summary.unpaidTableCount}
      unpaidTotal={summary.unpaidTotal}
      callCount={summary.callCount}
      menuCount={summary.menuCount}
      tableCount={summary.tableCount}
    />
  );
}
