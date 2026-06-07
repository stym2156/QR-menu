"use client";

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ink text-surface"
          : "bg-canvas text-muted hover:bg-line hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
