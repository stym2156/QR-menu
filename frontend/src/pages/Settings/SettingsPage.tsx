import { useEffect, useState } from "react";
import I18nPageHeader from "../../components/I18nPageHeader";
import { RESTAURANT_SELECT } from "../../lib/db/selects";
import { supabase } from "../../lib/supabase";
import type { Restaurant } from "../../lib/types";
import SettingsForm from "../../ported/dashboard/settings/SettingsForm";
import SettingsTeamHeadingClient from "../../ported/dashboard/settings/SettingsTeamHeadingClient";
import StaffManager from "../../ported/dashboard/settings/StaffManager";

interface StaffMember {
  id: string;
  user_id: string;
  role: "owner" | "staff" | "cook" | "waiter";
  invited_email: string | null;
  phone: string | null;
  created_at: string;
}

interface SettingsData {
  restaurant: Restaurant;
  userId: string;
  userEmail: string;
  members: StaffMember[];
}

export function SettingsPage({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<SettingsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const client = supabase();
      const [{ data: userData }, restaurantResult, membersResult] = await Promise.all([
        client.auth.getUser(),
        client
          .from("restaurants")
          .select(RESTAURANT_SELECT)
          .eq("id", restaurantId)
          .maybeSingle(),
        client
          .from("restaurant_members")
          .select("id, user_id, role, invited_email, phone, created_at")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled || !restaurantResult.data || !userData.user) return;
      setData({
        restaurant: restaurantResult.data as Restaurant,
        userId: userData.user.id,
        userEmail: userData.user.email ?? "",
        members: (membersResult.data ?? []) as StaffMember[],
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <I18nPageHeader titleKey="page.settings.title" descKey="page.settings.desc" />
        <SettingsForm restaurant={data.restaurant} userEmail={data.userEmail} />
      </div>

      <div>
        <SettingsTeamHeadingClient />
        <StaffManager
          restaurantId={data.restaurant.id}
          currentUserId={data.userId}
          initialMembers={data.members}
        />
      </div>
    </div>
  );
}

