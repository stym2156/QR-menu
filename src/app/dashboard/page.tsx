import { redirect } from "next/navigation";
import { getDashboardSummary } from "@/features/dashboard/queries";
import { requireDashboardSession } from "@/server/auth";
import DashboardCards from "./DashboardCards";
import { StatsPageContent } from "./stats/StatsPageContent";

export default async function DashboardPage() {
  const session = await requireDashboardSession();
  const { supabase, membership } = session;

  // Non-owners land on their primary work page instead of the owner dashboard.
  if (membership.role === "cook" || membership.role === "staff") {
    redirect("/dashboard/kitchen");
  }
  if (membership.role === "waiter") {
    redirect("/dashboard/bills");
  }

  const summary = await getDashboardSummary(supabase, membership.restaurantId);

  return (
    <div>
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
      <div className="mt-10">
        <StatsPageContent session={session} />
      </div>
    </div>
  );
}
