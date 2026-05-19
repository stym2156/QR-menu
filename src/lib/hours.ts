// Check if the shop is currently open based on accepting_orders flag + hours window.
// hours are stored as "HH:MM" strings (24-hour). Both must be set to enforce a window.
// If close_time < open_time, the window crosses midnight (e.g., 18:00 → 02:00).

export interface ShopStatus {
  isOpen: boolean;
  reason: "accepting" | "manually_closed" | "before_hours" | "after_hours";
  openTime: string | null;
  closeTime: string | null;
}

export function getShopStatus(restaurant: {
  accepting_orders: boolean;
  open_time: string | null;
  close_time: string | null;
}): ShopStatus {
  const openTime = restaurant.open_time || null;
  const closeTime = restaurant.close_time || null;

  if (!restaurant.accepting_orders) {
    return {
      isOpen: false,
      reason: "manually_closed",
      openTime,
      closeTime,
    };
  }

  if (!openTime || !closeTime) {
    return { isOpen: true, reason: "accepting", openTime, closeTime };
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === null || close === null) {
    return { isOpen: true, reason: "accepting", openTime, closeTime };
  }

  const insideWindow =
    close > open
      ? nowMinutes >= open && nowMinutes < close
      : nowMinutes >= open || nowMinutes < close;

  if (!insideWindow) {
    return {
      isOpen: false,
      reason: nowMinutes < open ? "before_hours" : "after_hours",
      openTime,
      closeTime,
    };
  }

  return { isOpen: true, reason: "accepting", openTime, closeTime };
}

function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
