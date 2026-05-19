import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import { PageHeader } from "@/components/ui";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!restaurant) {
    return <p className="text-muted">ยังไม่มีร้าน — กรุณา signup ใหม่</p>;
  }

  return (
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
  );
}
