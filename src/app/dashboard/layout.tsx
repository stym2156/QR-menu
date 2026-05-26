import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { SoundProvider } from "@/components/SoundProvider";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const membership = await getCurrentMembership(supabase);
  const { data: restaurant } = membership
    ? await supabase
        .from("restaurants")
        .select("name")
        .eq("id", membership.restaurantId)
        .maybeSingle()
    : { data: null };

  const restaurantName = restaurant?.name ?? "ร้านของคุณ";
  const role = membership?.role ?? "owner";

  return (
    <SoundProvider restaurantId={membership?.restaurantId ?? null}>
      <div className="min-h-screen bg-canvas">
        <Sidebar
          role={role}
          restaurantId={membership?.restaurantId ?? null}
          restaurantName={restaurantName}
        />
        <main className="lg:pl-64">
          <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </SoundProvider>
  );
}
