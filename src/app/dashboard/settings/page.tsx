import { createClient } from "@/lib/supabase/server";
import NoShopMessage from "@/components/NoShopMessage";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/membership";
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
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await getCurrentMembership(supabase);
  if (!membership) return null;
  if (membership.role !== "owner") redirect("/dashboard/kitchen");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", membership.restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }

  const { data: members } = await supabase
    .from("restaurant_members")
    .select("*")
    .eq("restaurant_id", membership.restaurantId)
    .order("created_at", { ascending: true });

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
