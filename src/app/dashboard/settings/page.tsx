import { redirect } from "next/navigation";
import { requireDashboardSession } from "@/server/auth";
import SettingsForm from "./SettingsForm";
import StaffManager from "./StaffManager";
import I18nPageHeader from "@/components/I18nPageHeader";
import SettingsTeamHeadingClient from "./SettingsTeamHeadingClient";
import type { Restaurant } from "@/lib/types";

interface StaffMember {
  id: string;
  user_id: string;
  role: "owner" | "staff" | "cook" | "waiter";
  invited_email: string | null;
  phone: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user, membership } = await requireDashboardSession();
  if (membership.role !== "owner") redirect("/dashboard/kitchen");

  const [{ data: restaurant }, { data: members }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("*")
      .eq("id", membership.restaurantId)
      .maybeSingle(),
    supabase
      .from("restaurant_members")
      .select("*")
      .eq("restaurant_id", membership.restaurantId)
      .order("created_at", { ascending: true }),
  ]);

  if (!restaurant) {
    return <p className="text-muted">ยังไม่มีร้าน - กรุณา signup ใหม่</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <I18nPageHeader
          titleKey="page.settings.title"
          descKey="page.settings.desc"
        />
        <SettingsForm
          restaurant={restaurant as Restaurant}
          userEmail={user.email ?? ""}
        />
      </div>

      <div>
        <SettingsTeamHeadingClient />
        <StaffManager
          restaurantId={membership.restaurantId}
          currentUserId={user.id}
          initialMembers={(members ?? []) as StaffMember[]}
        />
      </div>
    </div>
  );
}
