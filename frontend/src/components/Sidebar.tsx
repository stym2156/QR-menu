import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "../lib/i18n/LanguageSwitcher";
import { useT } from "../lib/i18n/I18nProvider";
import { go } from "../lib/router";
import { supabase } from "../lib/supabase";
import type { Role } from "../lib/types";
import { SoundToggle } from "./SoundToggle";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  allowedRoles?: Role[];
  badge?: "kitchen" | "bills";
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.home",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z" />,
  },
  {
    href: "/dashboard/menu",
    labelKey: "nav.menu",
    allowedRoles: ["owner"],
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h8M8 12h8M8 16h5" />,
  },
  {
    href: "/dashboard/categories",
    labelKey: "nav.categories",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z" />,
  },
  {
    href: "/dashboard/tables",
    labelKey: "nav.tables",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />,
  },
  {
    href: "/dashboard/kitchen",
    labelKey: "nav.kitchen",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    badge: "kitchen",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v6M10 2v6M14 2v6M18 2v6M3 8h18l-2 13H5L3 8Z" />,
  },
  {
    href: "/dashboard/bills",
    labelKey: "nav.bills",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    badge: "bills",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4" />,
  },
  {
    href: "/dashboard/promotions",
    labelKey: "nav.promotions",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41 13.4 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01" />,
  },
  {
    href: "/dashboard/stats",
    labelKey: "nav.stats",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    href: "/dashboard/close-shop",
    labelKey: "nav.close_shop",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 4h6v3H9zM10 12h4M10 16h4" />,
  },
  {
    href: "/dashboard/audit",
    labelKey: "nav.audit",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" />,
  },
  {
    href: "/dashboard/feedback",
    labelKey: "nav.feedback",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />,
  },
  {
    href: "/dashboard/settings",
    labelKey: "nav.settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  role,
  restaurantId,
  restaurantName,
}: {
  role: Role;
  restaurantId: string | null;
  restaurantName?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [counts, setCounts] = useState({ kitchen: 0, bills: 0 });
  const items = NAV.filter((item) => (item.allowedRoles ?? ["owner"]).includes(role));

  const refreshCounts = useCallback(async () => {
    if (!restaurantId) {
      setCounts({ kitchen: 0, bills: 0 });
      return;
    }

    const { data } = await supabase()
      .from("orders")
      .select("id, table_id, status, paid")
      .eq("restaurant_id", restaurantId)
      .eq("paid", false);

    const rows = (data ?? []) as Array<{
      id: string;
      table_id: string;
      status: string;
      paid: boolean;
    }>;
    const activeKitchen = rows.filter(
      (order) => order.status === "pending" || order.status === "ready",
    ).length;
    const unpaidTables = new Set(
      rows
        .filter((order) => order.status !== "cancelled")
        .map((order) => order.table_id),
    ).size;

    setCounts({ kitchen: activeKitchen, bills: unpaidTables });
  }, [restaurantId]);

  const badgeByType = useMemo(
    () => ({
      kitchen: counts.kitchen,
      bills: counts.bills,
    }),
    [counts],
  );

  useEffect(() => {
    const update = () => {
      setPathname(window.location.pathname);
      setOpen(false);
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  useEffect(() => {
    void refreshCounts();
    if (!restaurantId) return;

    const channel = supabase()
      .channel(`sidebar-counts:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void refreshCounts();
        },
      )
      .subscribe();

    return () => {
      void supabase().removeChannel(channel);
    };
  }, [restaurantId, refreshCounts]);

  async function signOut(): Promise<void> {
    await supabase().auth.signOut();
    go("/login");
  }

  return (
    <>
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 shadow-card backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"
          aria-label={t("nav.open_menu")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <button onClick={() => go("/dashboard")} className="text-base font-semibold tracking-tight text-ink">
          QR Menu
        </button>
      </div>

      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden"
          aria-label={t("nav.close_menu")}
        />
      ) : null}

      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 text-white shadow-pop transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <button onClick={() => go("/dashboard")} className="text-base font-semibold tracking-tight text-white">
            QR Menu
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t("nav.close_menu")}
          >
            x
          </button>
        </div>

        {restaurantName ? (
          <div className="border-b border-white/10 px-5 py-3">
            <p className="truncate text-xs font-medium text-white">{restaurantName}</p>
            {role !== "owner" ? (
              <p className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/65">
                {role}
              </p>
            ) : null}
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => go(item.href)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                      active
                        ? "bg-[#f4e4bd] text-[#174a34] shadow-ink ring-1 ring-[#f8e9c6]/70"
                        : "text-[#f7ead2]/85 hover:bg-[#f4e4bd]/12 hover:text-[#fff8e8]"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-full w-full">
                        {item.icon}
                      </svg>
                    </span>
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    {item.badge && badgeByType[item.badge] > 0 ? (
                      <span
                        className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                          active ? "bg-[#174a34] text-[#fff8e8]" : "bg-[#f4e4bd] text-[#174a34]"
                        }`}
                      >
                        {badgeByType[item.badge] > 99 ? "99+" : badgeByType[item.badge]}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-2 border-t border-white/10 px-3 py-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <LanguageSwitcher variant="compact" />
            <SoundToggle />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#f7ead2]/85 transition hover:bg-[#f4e4bd]/12 hover:text-[#fff8e8]"
          >
            {t("nav.sign_out")}
          </button>
        </div>
      </aside>
    </>
  );
}
