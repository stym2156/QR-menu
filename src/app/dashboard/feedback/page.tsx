import { createClient } from "@/lib/supabase/server";
import FeedbackView from "./FeedbackView";
import { PageHeader } from "@/components/ui";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

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
