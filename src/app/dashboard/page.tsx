import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { formatKIP } from "@/lib/format";
import StatsPage from "./stats/page";
import DashboardCards from "./DashboardCards";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  // Non-owners land on their primary work page instead of the owner dashboard.
  if (membership?.role === "cook" || membership?.role === "staff") {
    redirect("/dashboard/kitchen");
  }
  if (membership?.role === "waiter") {
    redirect("/dashboard/bills");
  }

  const restaurantId = membership?.restaurantId ?? "";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: menuCount },
    { count: tableCount },
    { count: pendingCount },
    { count: callCount },
    { data: todayPaid },
    { data: unpaidOrders },
  ] = await Promise.all([
    supabase
      .from("menus")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "pending"),
    supabase
      .from("call_staff_requests")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("acknowledged", false),
    supabase
      .from("orders")
      .select("total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", true)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("table_id, total")
      .eq("restaurant_id", restaurantId)
      .eq("paid", false),
  ]);

  const todayRevenue = (todayPaid ?? []).reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  const unpaidTableCount = new Set((unpaidOrders ?? []).map((o) => o.table_id)).size;
  const unpaidTotal = (unpaidOrders ?? []).reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  return (
    <div>
      <DashboardCards
        todayRevenue={todayRevenue}
        todayPaidCount={todayPaid?.length ?? 0}
        pendingCount={pendingCount ?? 0}
        unpaidTableCount={unpaidTableCount}
        unpaidTotal={unpaidTotal}
        callCount={callCount ?? 0}
        menuCount={menuCount ?? 0}
        tableCount={tableCount ?? 0}
      />
      <div className="mt-10">
        <StatsPage />
      </div>
    </div>
  );
}
