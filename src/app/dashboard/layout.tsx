import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
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
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/dashboard"
              className="shrink-0 text-base font-semibold tracking-tight text-ink"
            >
              QR Menu
            </Link>
            <TopNav role={role} />
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="max-w-[14ch] truncate text-xs text-muted">
              {restaurantName}
            </span>
            {role === "staff" ? (
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                staff
              </span>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
