import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { SoundProvider } from "@/components/SoundProvider";
import { SoundToggle } from "@/components/SoundToggle";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import SignOutButton from "./SignOutButton";
import TopNav from "./TopNav";

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
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex items-center justify-between gap-4 py-3">
              <Link
                href="/dashboard"
                className="shrink-0 text-base font-semibold tracking-tight text-ink"
              >
                QR Menu
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <LanguageSwitcher variant="compact" />
                <SoundToggle />
                <span className="hidden max-w-[14ch] truncate text-xs text-muted sm:inline">
                  {restaurantName}
                </span>
                {role === "staff" ? (
                  <span className="hidden rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted sm:inline">
                    staff
                  </span>
                ) : null}
                <div className="hidden sm:block">
                  <SignOutButton />
                </div>
              </div>
            </div>
            <div className="border-t border-line py-2">
              <TopNav role={role} restaurantId={membership?.restaurantId ?? null} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </div>
    </SoundProvider>
  );
}
