import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import StaffManager from "./StaffManager";
import { PageHeader, SectionHeading } from "@/components/ui";
import type { Restaurant } from "@/lib/types";

interface StaffMember {
  id: string;
  user_id: string;
  role: "owner" | "staff";
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
        <PageHeader
          title="ตั้งค่าร้าน"
          description="ชื่อร้าน · เวลาทำการ · รหัสผ่าน"
        />
        <SettingsForm
          restaurant={restaurant as Restaurant}
          userEmail={user.email ?? ""}
        />
      </div>

      <div>
        <SectionHeading
          title="พนักงาน"
          description="เพิ่มทีมงานให้เข้าใช้หน้า ครัว + เช็คบิล (ไม่เห็นยอดขาย/ตั้งค่า)"
        />
        <StaffManager
          restaurantId={membership.restaurantId}
          currentUserId={user.id}
          initialMembers={(members ?? []) as StaffMember[]}
        />
      </div>
    </div>
  );
}
