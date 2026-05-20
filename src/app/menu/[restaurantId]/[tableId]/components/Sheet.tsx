"use client";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end animate-fade-in bg-ink/30 sm:items-center sm:justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full animate-slide-up overflow-y-auto rounded-t-3xl bg-surface sm:max-w-md sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
