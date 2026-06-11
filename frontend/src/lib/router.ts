export type Route =
  | { name: "home" }
  | { name: "login" }
  | { name: "signup" }
  | { name: "forgot-password" }
  | { name: "reset-password" }
  | {
      name: "dashboard";
      page:
        | "home"
        | "menu"
        | "categories"
        | "tables"
        | "kitchen"
        | "bills"
        | "settings"
        | "stats"
        | "promotions"
        | "close-shop"
        | "audit"
        | "feedback";
    }
  | { name: "customer-menu"; restaurantId: string; tableId: string }
  | { name: "customer-table-code"; code: string }
  | { name: "not-found" };

export function parseRoute(pathname = window.location.pathname): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "login") return { name: "login" };
  if (parts[0] === "signup") return { name: "signup" };
  if (parts[0] === "forgot-password") return { name: "forgot-password" };
  if (parts[0] === "reset-password") return { name: "reset-password" };
  if (parts[0] === "dashboard") {
    const page = (parts[1] ?? "home") as Route extends { name: "dashboard"; page: infer P } ? P : never;
    if ([
      "home",
      "menu",
      "categories",
      "tables",
      "kitchen",
      "bills",
      "settings",
      "stats",
      "promotions",
      "close-shop",
      "audit",
      "feedback",
    ].includes(page)) {
      return { name: "dashboard", page };
    }
  }
  if (parts[0] === "menu" && parts[1] && parts[2]) {
    return { name: "customer-menu", restaurantId: parts[1], tableId: parts[2] };
  }
  if (parts[0] === "t" && parts[1]) {
    return { name: "customer-table-code", code: parts[1] };
  }
  return { name: "not-found" };
}

export function go(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
