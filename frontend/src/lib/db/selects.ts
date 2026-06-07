export const MENU_SELECT =
  "id, restaurant_id, category_id, name, name_lo, name_en, price, image_url, available, created_at";

export const CATEGORY_SELECT =
  "id, restaurant_id, name, name_lo, name_en, sort_order, created_at";

export const PROMOTION_SELECT =
  "id, restaurant_id, title, description, image_url, active, sort_order, start_at, end_at, created_at";

export const TABLE_SELECT =
  "id, restaurant_id, zone_id, table_number, qr_url, is_open, created_at";

export const TABLE_ZONE_SELECT =
  "id, restaurant_id, name, sort_order, created_at";

export const RESTAURANT_SELECT =
  "id, user_id, name, accepting_orders, open_time, close_time, service_charge_pct, vat_pct, payment_qr_url, kitchen_print_width, created_at";

export const ORDER_SELECT =
  "id, table_id, restaurant_id, items, status, total, paid, paid_at, payment_method, cancel_reason, accepted_at, accepted_by, completed_at, completed_by, created_at";

export const CALL_STAFF_SELECT =
  "id, restaurant_id, table_id, reason, acknowledged, created_at";
