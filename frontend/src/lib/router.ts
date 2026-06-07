export type Route =
  | { name: "home" }
  | { name: "login" }
  | { name: "signup" }
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
  | { name: "not-found" };

export function parseRoute(pathname = window.location.pathname): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "login") return { name: "login" };
  if (parts[0] === "signup") return { name: "signup" };
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
  return { name: "not-found" };
}

export function go(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
