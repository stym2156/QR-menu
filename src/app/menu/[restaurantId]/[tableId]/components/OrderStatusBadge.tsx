import type { Order } from "@/lib/types";

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-800">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        กำลังทำ
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        พร้อมเสิร์ฟ
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-red-700">
        ✕ ยกเลิก
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted">
      ✓ เสิร์ฟแล้ว
    </span>
  );
}
