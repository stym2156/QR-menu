"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { SoundToggle } from "@/components/SoundToggle";
import SignOutButton from "./SignOutButton";
import type { RestaurantRole } from "@/lib/membership";
import { useNavBadges, type NavBadges } from "./useNavBadges";

type Role = RestaurantRole;

// Maps an item href → which badge count (from useNavBadges) to render on it.
const BADGE_KEY: Record<string, keyof NavBadges | undefined> = {
  "/dashboard/kitchen": "kitchen",
  "/dashboard/bills": "bills",
};

interface NavItem {
  href: string;
  // i18n key for the label (e.g., "nav.home"). Resolved at render time.
  labelKey: string;
  icon: React.ReactNode;
  // Roles that can see this nav item. Defaults to owner-only when omitted.
  allowedRoles?: Role[];
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/menu",
    labelKey: "nav.menu",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h8M8 12h8M8 16h5"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/categories",
    labelKey: "nav.categories",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/tables",
    labelKey: "nav.tables",
    allowedRoles: ["owner", "cook", "waiter"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/kitchen",
    labelKey: "nav.kitchen",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 2v6M10 2v6M14 2v6M18 2v6M3 8h18l-2 13H5L3 8Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/bills",
    labelKey: "nav.bills",
    allowedRoles: ["owner", "cook", "waiter", "staff"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/promotions",
    labelKey: "nav.promotions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.59 13.41 13.4 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/stats",
    labelKey: "nav.stats",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/close-shop",
    labelKey: "nav.close_shop",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7h18M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 4h6v3H9zM10 12h4M10 16h4"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/audit",
    labelKey: "nav.audit",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/feedback",
    labelKey: "nav.feedback",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    labelKey: "nav.settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="3" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        />
      </svg>
    ),
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  role?: RestaurantRole;
  restaurantId?: string | null;
  restaurantName?: string;
}

export default function Sidebar({
  role = "owner",
  restaurantId = null,
  restaurantName,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useT();
  const badges = useNavBadges(restaurantId);
  const [open, setOpen] = useState(false);

  // Auto-close the mobile drawer when the route changes — otherwise tapping
  // a nav item leaves the overlay covering the page the user just landed on.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Items without allowedRoles default to owner-only.
  const items = NAV.filter((item) => {
    const allowed = item.allowedRoles ?? ["owner"];
    return allowed.includes(role);
  });

  return (
    <>
      {/* ── Mobile-only top bar with hamburger + brand ──────────── */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"
          aria-label={t("nav.open_menu")}
        >
          <HamburgerIcon />
        </button>
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight text-ink"
        >
          QR Menu
        </Link>
      </div>

      {/* ── Backdrop for mobile drawer ───────────────────────────── */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      ) : null}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-ink"
          >
            QR Menu
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink lg:hidden"
            aria-label={t("nav.close_menu")}
          >
            ✕
          </button>
        </div>

        {/* Restaurant info */}
        {restaurantName ? (
          <div className="border-b border-line px-5 py-3">
            <p className="truncate text-xs font-medium text-ink">
              {restaurantName}
            </p>
            {role === "staff" ? (
              <p className="mt-1 inline-block rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                staff
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const badgeKey = BADGE_KEY[item.href];
              const count = badgeKey ? badges[badgeKey] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-ink text-surface"
                        : "text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
                      {item.icon}
                      {count > 0 ? (
                        <span
                          className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-surface"
                          aria-label={`${count}`}
                        >
                          {count > 9 ? "9+" : count}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer controls */}
        <div className="space-y-2 border-t border-line px-3 py-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <LanguageSwitcher variant="compact" />
            <SoundToggle />
          </div>
          <div className="px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
