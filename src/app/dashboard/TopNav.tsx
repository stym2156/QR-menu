"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RestaurantRole } from "@/lib/membership";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  staffAllowed?: boolean;
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "หน้าหลัก",
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
    label: "เมนู",
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
    label: "หมวดหมู่",
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
    label: "โต๊ะ & QR",
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
    label: "ครัว",
    staffAllowed: true,
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
    label: "เช็คบิล",
    staffAllowed: true,
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
    label: "โปรโมชัน",
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
    label: "สถิติ",
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
    href: "/dashboard/feedback",
    label: "ส่งข้อความ",
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
    label: "ตั้งค่า",
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

export default function TopNav({ role = "owner" }: { role?: RestaurantRole }) {
  const pathname = usePathname();
  const items = role === "staff" ? NAV.filter((n) => n.staffAllowed) : NAV;

  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-canvas text-ink"
                : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
