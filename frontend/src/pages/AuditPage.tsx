import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AuditView, { type AuditLogRow } from "../ported/dashboard/audit/AuditView";

interface AuditData {
  rows: AuditLogRow[];
  actorEmails: Record<string, string>;
}

export function AuditPage({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<AuditData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const [logs, members] = await Promise.all([
        client
          .from("audit_logs")
          .select("id, action, target_id, details, created_at, actor_user_id")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(300),
        client.rpc("lookup_member_emails", { rid: restaurantId }),
      ]);

      if (cancelled) return;
      const actorEmails: Record<string, string> = {};
      for (const member of (members.data ?? []) as Array<{ user_id: string; email: string }>) {
        actorEmails[member.user_id] = member.email;
      }
      setData({
        rows: (logs.data ?? []) as AuditLogRow[],
        actorEmails,
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return data ? (
    <AuditView rows={data.rows} actorEmails={data.actorEmails} pageSize={300} />
  ) : (
    <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
      Loading audit logs...
    </div>
  );
}
