"use client";

interface FloatingButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  accent?: boolean;
  badge?: string | null;
}

export function FloatingButton({
  icon,
  label,
  onClick,
  accent,
  badge,
}: FloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium shadow-pop backdrop-blur transition active:scale-95 ${
        accent
          ? "border-accent-600 bg-accent-600 text-surface hover:bg-accent-700"
          : "border-line bg-surface/95 text-ink hover:border-ink/30"
      }`}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span>{label}</span>
      {badge ? (
        <span className="absolute -right-1 -top-1 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-surface shadow-card">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-100" />
          </span>
          {badge}
        </span>
      ) : null}
    </button>
  );
}
