import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import AdminSignOutButton from "./AdminSignOutButton";
import AdminNav from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between gap-4 py-3">
            <Link
              href="/admin"
              className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-ink"
            >
              <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface">
                Admin
              </span>
              <span>QR Menu</span>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden max-w-[18ch] truncate text-xs text-muted sm:inline">
                {admin.email ?? "—"}
              </span>
              <AdminSignOutButton />
            </div>
          </div>
          <div className="border-t border-line py-2">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
