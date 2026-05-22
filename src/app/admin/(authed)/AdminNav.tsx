"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/admin",
    label: "ร้านทั้งหมด",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v9a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9M2 11l10-8 10 8" />
      </svg>
    ),
  },
  {
    href: "/admin/feedback",
    label: "ข้อความจากร้าน",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-full w-full">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      </svg>
    ),
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 flex gap-x-1 overflow-x-auto lg:gap-x-1.5 lg:overflow-visible">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-canvas text-ink" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
