"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      const entry: PendingConfirm = { options, resolve };
      pendingRef.current = entry;
      setPending(entry);
    });
  }, []);

  function handle(answer: boolean): void {
    const entry = pendingRef.current;
    if (entry) entry.resolve(answer);
    pendingRef.current = null;
    setPending(null);
  }

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmModal
          options={pending.options}
          onConfirm={() => handle(true)}
          onCancel={() => handle(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to browser confirm if provider missing.
    return ({ title, description }: ConfirmOptions) =>
      Promise.resolve(window.confirm(description ? `${title}\n\n${description}` : title));
  }
  return ctx;
}

function ConfirmModal({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = options.tone === "danger";
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in bg-ink/40 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-slide-up overflow-hidden rounded-2xl bg-surface shadow-pop"
      >
        <div className="px-5 pt-5">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            {options.title}
          </h3>
          {options.description ? (
            <p className="mt-1.5 text-sm text-muted">{options.description}</p>
          ) : null}
        </div>
        <div className="mt-5 flex gap-2 border-t border-line bg-canvas/40 px-5 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            {options.cancelText ?? "ยกเลิก"}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-surface transition active:scale-[0.98] ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-ink hover:bg-ink/85"
            }`}
          >
            {options.confirmText ?? "ยืนยัน"}
          </button>
        </div>
      </div>
    </div>
  );
}
