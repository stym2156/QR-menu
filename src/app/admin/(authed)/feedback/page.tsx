import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import AdminFeedbackView from "./AdminFeedbackView";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";

interface FeedbackWithRestaurant extends Feedback {
  restaurant_name: string | null;
}

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  await requireAdmin(supabase);

  // RLS now allows admins to read all feedback (see migration 0014).
  const { data: feedback } = await supabase
    .from("feedback")
    .select("*, restaurants(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  // Flatten the nested restaurants relation into restaurant_name.
  const rows: FeedbackWithRestaurant[] = ((feedback ?? []) as Array<
    Feedback & { restaurants: { name: string } | null }
  >).map((f) => ({
    ...f,
    restaurant_name: f.restaurants?.name ?? null,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          ข้อความจากร้าน
        </h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} ข้อความ · เรียงใหม่→เก่า · แสดงสูงสุด 200 ล่าสุด
        </p>
      </header>
      <AdminFeedbackView initialFeedback={rows} />
    </div>
  );
}
