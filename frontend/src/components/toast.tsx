"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info"): void => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, tone, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: no provider mounted — silently no-op so callers don't crash.
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: "bg-emerald-600 text-surface",
  error: "bg-red-600 text-surface",
  info: "bg-ink text-surface",
};

const TONE_ICON: Record<ToastTone, string> = {
  success: "✓",
  error: "✕",
  info: "•",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), 3700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      onClick={onDismiss}
      className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-pop transition ${
        TONE_CLASS[toast.tone]
      } ${leaving ? "opacity-0 -translate-y-2" : "animate-slide-up"}`}
    >
      <span className="text-base leading-tight">{TONE_ICON[toast.tone]}</span>
      <span className="text-left">{toast.message}</span>
    </button>
  );
}
