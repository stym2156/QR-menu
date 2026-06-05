import { redirect } from "next/navigation";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import FeedbackView from "./FeedbackView";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { supabase, user, membership } = await requireDashboardSession();
  if (!isOwner(membership.role)) redirect("/dashboard");

  const [{ data: restaurant }, { data: feedback }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", membership.restaurantId)
      .maybeSingle(),
    supabase
      .from("feedback")
      .select("id, user_id, restaurant_id, email, category, message, resolved, admin_reply, replied_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <FeedbackView
        userId={user.id}
        userEmail={user.email ?? ""}
        restaurantId={restaurant?.id ?? null}
        restaurantName={restaurant?.name ?? null}
        initialFeedback={(feedback ?? []) as Feedback[]}
      />
    </div>
  );
}
