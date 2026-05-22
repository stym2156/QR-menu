export type OrderStatus = "pending" | "ready" | "served" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "promptpay" | "card" | "other";

export type Restaurant = {
  id: string;
  user_id: string;
  name: string;
  accepting_orders: boolean;
  open_time: string | null;
  close_time: string | null;
  service_charge_pct: number;
  vat_pct: number;
  payment_qr_url: string | null;
  created_at: string;
};

export type DiningTable = {
  id: string;
  restaurant_id: string;
  table_number: number;
  qr_url: string | null;
  is_open: boolean;
  created_at: string;
};

export type FeedbackCategory = "bug" | "feature" | "general" | "question";

export type Feedback = {
  id: string;
  user_id: string | null;
  restaurant_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  resolved: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  name_lo: string | null;
  name_en: string | null;
  sort_order: number;
  created_at: string;
};

export type MenuBundle = {
  label: string;
  qty: number;
};

export type Menu = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  name_lo: string | null;
  name_en: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  bundles: MenuBundle[];
  created_at: string;
};

export type OrderItem = {
  menu_id: string;
  qty: number;
  note?: string;
};

export type Order = {
  id: string;
  table_id: string;
  restaurant_id: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  cancel_reason: string | null;
  created_at: string;
};

export type CallStaffRequest = {
  id: string;
  restaurant_id: string;
  table_id: string;
  reason: string | null;
  acknowledged: boolean;
  created_at: string;
};

export type Promotion = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
};
