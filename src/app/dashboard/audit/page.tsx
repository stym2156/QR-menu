import { redirect } from "next/navigation";
import NoShopMessage from "@/components/NoShopMessage";
import { isOwner } from "@/lib/membership";
import { requireDashboardSession } from "@/server/auth";
import AuditView, { type AuditLogRow } from "./AuditView";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

export default async function AuditPage() {
  const { supabase, membership } = await requireDashboardSession();
  if (!membership) return <NoShopMessage />;
  if (!isOwner(membership.role)) redirect("/dashboard");

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, target_id, details, created_at, actor_user_id")
    .eq("restaurant_id", membership.restaurantId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // Resolve actor emails in one round trip via the existing member-email RPC
  // (introduced in migration 0016). Falls back to "system" for null actors.
  const actorIds = Array.from(
    new Set((logs ?? []).map((l) => l.actor_user_id).filter(Boolean)),
  ) as string[];

  let actorEmails: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: emailRows } = await supabase.rpc("lookup_member_emails", {
      user_ids: actorIds,
    });
    actorEmails = Object.fromEntries(
      (emailRows ?? []).map((r: { id: string; email: string }) => [r.id, r.email]),
    );
  }

  return (
    <AuditView
      rows={(logs ?? []) as AuditLogRow[]}
      actorEmails={actorEmails}
      pageSize={PAGE_SIZE}
    />
  );
}
