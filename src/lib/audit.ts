"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Dotted taxonomy. Adding a new action only requires extending this union
// — no DB migration needed because the column is plain text.
export type AuditAction =
  | "order.cancel"
  | "order.served"
  | "order.printed"
  | "bill.settle"
  | "table.open"
  | "table.close"
  | "menu.create"
  | "menu.update"
  | "menu.delete"
  | "call.ready";

export interface AuditEntry {
  action: AuditAction;
  // The primary entity affected. Usually an order/bill/table id.
  targetId?: string | null;
  // Context the owner will want when investigating later.
  details?: Record<string, unknown>;
}

/**
 * Insert a row into audit_logs. Best-effort — never throws or blocks the
 * calling action. If the log fails, the user's real work still succeeds;
 * we'd rather lose an audit row than block a bill settle.
 */
export async function logAudit(
  supabase: SupabaseClient,
  restaurantId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      restaurant_id: restaurantId,
      actor_user_id: user?.id ?? null,
      action: entry.action,
      target_id: entry.targetId ?? null,
      details: entry.details ?? {},
    });
  } catch {
    /* noop — never block real work for a log row */
  }
}
