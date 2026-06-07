import type { ReactNode } from "react";
import { go } from "../lib/router";

export const card = "rounded-2xl border border-line bg-surface shadow-card";
export const cardPad = "p-5";
export const input =
  "w-full rounded-xl border border-line bg-[#fffdf6] px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 shadow-sm transition focus:border-accent-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-100";
export const labelClass = "mb-1.5 block text-xs font-semibold text-ink/70";
export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";
export const buttonPrimary =
  `${buttonBase} bg-ink text-[#fff8e8] shadow-ink hover:bg-[#1f5a40] active:scale-[0.98]`;
export const buttonSecondary =
  `${buttonBase} border border-line bg-[#fff8e8] text-ink shadow-card hover:border-[#b89557] hover:bg-[#fff3d5]`;
export const buttonGhost =
  `${buttonBase} text-muted hover:bg-[#fff3d5] hover:text-ink`;
export const buttonDanger =
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 border-l-4 border-[#c69a4a] pl-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-[#fff8e8]/80 p-12 text-center shadow-card">
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f4e4bd] text-ink">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type StatusTone = "neutral" | "warning" | "success" | "info" | "danger";

const statusToneClasses: Record<StatusTone, string> = {
  neutral: "bg-[#f4e4bd] text-ink/75",
  warning: "bg-[#fff3d5] text-amber-900",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-accent-50 text-accent-700",
  danger: "bg-red-50 text-red-700",
};

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusToneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const FormField = Field;

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls = variant === "primary" ? buttonPrimary : variant === "ghost" ? buttonGhost : buttonSecondary;
  return (
    <button type="button" onClick={() => go(href)} className={cls}>
      {children}
    </button>
  );
}
