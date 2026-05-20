"use client";

import { useSound } from "./SoundProvider";

/**
 * Compact bell-icon button that toggles the global sound state.
 * Sits in the dashboard header so it's reachable from every page.
 */
export function SoundToggle() {
  const { soundOn, toggle } = useSound();

  return (
    <button
      onClick={toggle}
      aria-label={soundOn ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
      title={soundOn ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
        soundOn
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
      }`}
    >
      {soundOn ? (
        <span className="relative inline-flex">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.4L4 17h5m6 0a3 3 0 1 1-6 0"
            />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3l18 18M9.34 5.66A6 6 0 0 1 18 11v3.2c0 .27.05.53.16.78M5 17l-1-1.4c.38-.36.59-.87.59-1.4V11M9 17a3 3 0 0 0 6 0M15 17H4"
          />
        </svg>
      )}
    </button>
  );
}
