import type { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { SoundProvider } from "../components/SoundProvider";
import { go } from "../lib/router";
import { supabase } from "../lib/supabase";
import type { Restaurant, Role } from "../lib/types";

export function DashboardLayout({
  children,
  role,
  restaurant,
}: {
  children: ReactNode;
  role: Role;
  restaurant: Restaurant | null;
}) {
  return (
    <SoundProvider restaurantId={restaurant?.id ?? null}>
      <div className="min-h-screen bg-canvas text-ink">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 lg:hidden">
          <button onClick={() => go("/dashboard")} className="font-semibold text-ink">
            QR Menu
          </button>
          <button
            onClick={() => void supabase().auth.signOut().then(() => go("/login"))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted"
          >
            Sign out
          </button>
        </div>
        <Sidebar role={role} restaurantName={restaurant?.name} />
        <main className="lg:pl-64">
          <div className="px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </SoundProvider>
  );
}
