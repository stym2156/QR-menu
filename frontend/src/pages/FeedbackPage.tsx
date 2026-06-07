import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Feedback } from "../lib/types";
import FeedbackView from "../ported/dashboard/feedback/FeedbackView";

interface FeedbackData {
  userId: string;
  userEmail: string;
  restaurantName: string | null;
  feedback: Feedback[];
}

export function FeedbackPage({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<FeedbackData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return;
      const [restaurant, feedback] = await Promise.all([
        client.from("restaurants").select("name").eq("id", restaurantId).maybeSingle(),
        client
          .from("feedback")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (!cancelled) {
        setData({
          userId: userData.user.id,
          userEmail: userData.user.email ?? "",
          restaurantName: (restaurant.data as { name?: string } | null)?.name ?? null,
          feedback: (feedback.data ?? []) as Feedback[],
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return data ? (
    <FeedbackView
      userId={data.userId}
      userEmail={data.userEmail}
      restaurantId={restaurantId}
      restaurantName={data.restaurantName}
      initialFeedback={data.feedback}
    />
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
      Loading feedback...
    </div>
  );
}
