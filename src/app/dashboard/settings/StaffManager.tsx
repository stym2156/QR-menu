"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EmptyState,
  SectionHeading,
  buttonPrimary,
  buttonSecondary,
  card,
  cardPad,
} from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "staff" | "cook" | "waiter";
  invited_email: string | null;
  phone: string | null;
  created_at: string;
}

interface Invite {
  id: string;
  token: string;
  role: "cook" | "waiter";
  created_at: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
}

interface Props {
  restaurantId: string;
  currentUserId: string;
  initialMembers: Member[];
}

const ROLE_KEY: Record<Member["role"], string> = {
  owner: "staff.role.owner_label",
  staff: "staff.role.staff_label",
  cook: "role.cook",
  waiter: "role.waiter",
};

const ROLE_COLOR: Record<Member["role"], string> = {
  owner: "bg-ink text-surface",
  staff: "bg-emerald-50 text-emerald-700",
  cook: "bg-amber-50 text-amber-700",
  waiter: "bg-sky-50 text-sky-700",
};

export default function StaffManager({
  restaurantId,
  currentUserId,
  initialMembers,
}: Props) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { t } = useT();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [origin, setOrigin] = useState("");
  const [creatingRole, setCreatingRole] = useState<"cook" | "waiter" | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  async function loadInvites(): Promise<void> {
    const { data } = await supabase
      .from("restaurant_invites")
      .select("id, token, role, created_at, used_at, used_by, revoked_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  }

  function makeToken(): string {
    // 24-char URL-safe random token. Uses crypto for entropy.
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function createInvite(role: "cook" | "waiter"): Promise<void> {
    setCreatingRole(role);
    const token = makeToken();
    const { data, error } = await supabase
      .from("restaurant_invites")
      .insert({
        restaurant_id: restaurantId,
        token,
        role,
        created_by: currentUserId,
      })
      .select("id, token, role, created_at, used_at, used_by, revoked_at")
      .single();
    setCreatingRole(null);
    if (error || !data) {
      toast.error(t("staff.create.failed", { error: error?.message ?? "unknown" }));
      return;
    }
    setInvites((prev) => [data as Invite, ...prev]);
    const url = `${origin}/join/${(data as Invite).token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("staff.created.copied"));
    } catch {
      toast.success(t("staff.created.fallback"));
    }
  }

  async function copyInvite(invite: Invite): Promise<void> {
    const url = `${origin}/join/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(invite.token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch {
      toast.error(t("staff.copy_failed"));
    }
  }

  async function revokeInvite(invite: Invite): Promise<void> {
    const ok = await confirm({
      title: t("staff.revoke.title"),
      description: t("staff.revoke.desc"),
      confirmText: t("staff.revoke.confirm"),
      tone: "danger",
    });
    if (!ok) return;
    const now = new Date().toISOString();
    setInvites((prev) =>
      prev.map((i) => (i.id === invite.id ? { ...i, revoked_at: now } : i)),
    );
    const { error } = await supabase
      .from("restaurant_invites")
      .update({ revoked_at: now })
      .eq("id", invite.id);
    if (error) {
      toast.error(t("staff.revoke.failed", { error: error.message }));
      void loadInvites();
      return;
    }
    toast.success(t("staff.revoked"));
  }

  async function removeMember(m: Member): Promise<void> {
    if (m.role === "owner") {
      toast.error(t("staff.remove.cant_owner"));
      return;
    }
    if (m.user_id === currentUserId) {
      toast.error(t("staff.remove.cant_self"));
      return;
    }
    const ok = await confirm({
      title: t("staff.remove.title", { name: m.invited_email ?? m.user_id }),
      description: t("staff.remove.desc"),
      confirmText: t("staff.remove.confirm"),
      tone: "danger",
    });
    if (!ok) return;
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
    const { error } = await supabase
      .from("restaurant_members")
      .delete()
      .eq("id", m.id);
    if (error) toast.error(t("staff.remove.failed", { error: error.message }));
    else toast.success(t("staff.removed"));
  }

  const activeInvites = invites.filter((i) => !i.used_at && !i.revoked_at);

  return (
    <div className="space-y-5">
      <div className={`${card} ${cardPad} space-y-4`}>
        <SectionHeading
          title={t("staff.create.title")}
          description={t("staff.create.desc")}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => createInvite("cook")}
            disabled={creatingRole !== null}
            className={`${buttonPrimary} py-3`}
          >
            {creatingRole === "cook" ? t("staff.creating") : t("staff.create.cook")}
          </button>
          <button
            type="button"
            onClick={() => createInvite("waiter")}
            disabled={creatingRole !== null}
            className={`${buttonPrimary} py-3`}
          >
            {creatingRole === "waiter" ? t("staff.creating") : t("staff.create.waiter")}
          </button>
        </div>

        {activeInvites.length > 0 ? (
          <div className="space-y-2 border-t border-line pt-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted">
              {t("staff.active.title", { n: activeInvites.length })}
            </div>
            <ul className="space-y-2">
              {activeInvites.map((invite) => {
                const url = `${origin}/join/${invite.token}`;
                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas/40 px-3 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        invite.role === "cook"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {t(ROLE_KEY[invite.role])}
                    </span>
                    <code className="min-w-0 flex-1 truncate text-[11px] text-muted">
                      {url}
                    </code>
                    <button
                      onClick={() => void copyInvite(invite)}
                      className={`${buttonSecondary} shrink-0 py-1.5 text-xs`}
                    >
                      {copiedToken === invite.token ? t("staff.copied") : t("staff.copy")}
                    </button>
                    <button
                      onClick={() => void revokeInvite(invite)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
                    >
                      {t("staff.revoke")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <div className={`${card} ${cardPad}`}>
        <SectionHeading
          title={t("staff.members.title")}
          description={t("staff.members.count", { n: members.length })}
        />
        {members.length === 0 ? (
          <EmptyState title={t("staff.members.empty")} />
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {m.invited_email ?? m.user_id}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${ROLE_COLOR[m.role]}`}
                    >
                      {t(ROLE_KEY[m.role])}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {t("staff.added_at", { time: formatDateTime(m.created_at) })}
                  </div>
                  {m.phone ? (
                    <div className="mt-0.5 text-[11px] text-muted">
                      📞{" "}
                      <a
                        href={`tel:${m.phone}`}
                        className="text-ink hover:text-accent-600"
                      >
                        {m.phone}
                      </a>
                    </div>
                  ) : null}
                </div>
                {m.role !== "owner" && m.user_id !== currentUserId ? (
                  <button
                    onClick={() => removeMember(m)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    {t("common.delete")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
