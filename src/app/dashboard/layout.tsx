import { redirect } from "next/navigation";
import { getDashboardSession } from "@/server/auth";
import { SoundProvider } from "@/components/SoundProvider";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSession();

  if (!session) redirect("/login");

  const { supabase, membership } = session;
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", membership.restaurantId)
    .maybeSingle();

  const restaurantName = restaurant?.name ?? "ร้านของคุณ";
  const role = membership.role;

  return (
    <SoundProvider restaurantId={membership.restaurantId}>
      <div className="min-h-screen bg-canvas">
        <Sidebar
          role={role}
          restaurantId={membership.restaurantId}
          restaurantName={restaurantName}
        />
        <main className="lg:pl-64">
          {/* Content fills the full width remaining after the sidebar - no
              max-w cap, no auto-centering. Sidebar already offsets content
              from one side; centering again only manufactures dead space. */}
          <div className="px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </SoundProvider>
  );
}
