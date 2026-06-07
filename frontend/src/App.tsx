import { lazy, Suspense, useEffect, useState } from "react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { hasSupabaseEnv } from "./lib/env";
import { go, parseRoute, type Route } from "./lib/router";
import { useWorkspace } from "./lib/workspace";
import { LoginPage, SignupPage } from "./pages/AuthPages";

const BillsPage = lazy(() => import("./pages/BillsPage").then((m) => ({ default: m.BillsPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const CloseShopPage = lazy(() => import("./pages/CloseShopPage").then((m) => ({ default: m.CloseShopPage })));
const CustomerMenuPage = lazy(() => import("./pages/CustomerMenuPage").then((m) => ({ default: m.CustomerMenuPage })));
const DashboardHome = lazy(() => import("./pages/DashboardHome").then((m) => ({ default: m.DashboardHome })));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const KitchenPage = lazy(() => import("./pages/KitchenPage").then((m) => ({ default: m.KitchenPage })));
const MenuPage = lazy(() => import("./pages/MenuPage").then((m) => ({ default: m.MenuPage })));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage").then((m) => ({ default: m.PromotionsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const StatsPage = lazy(() => import("./pages/StatsPage").then((m) => ({ default: m.StatsPage })));
const TablesPage = lazy(() => import("./pages/TablesPage").then((m) => ({ default: m.TablesPage })));

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const workspace = useWorkspace();

  useEffect(() => {
    const update = () => setRoute(parseRoute());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  if (!hasSupabaseEnv()) return <MissingEnvPage />;

  if (route.name === "customer-menu") {
    return (
      <Suspense fallback={<PageLoading />}>
        <CustomerMenuPage restaurantId={route.restaurantId} tableId={route.tableId} />
      </Suspense>
    );
  }
  if (route.name === "customer-table-code") {
    return (
      <Suspense fallback={<PageLoading />}>
        <CustomerMenuPage tableCode={route.code} />
      </Suspense>
    );
  }
  if (route.name === "login") return <LoginPage />;
  if (route.name === "signup") return <SignupPage />;
  if (route.name === "home") return <PublicHome />;

  if (route.name === "dashboard") {
    if (workspace.loading) {
      return <main className="min-h-screen bg-canvas p-6 text-muted">Loading...</main>;
    }
    if (!workspace.userId) return <LoginPage />;

    return (
      <DashboardLayout role={workspace.role} restaurant={workspace.restaurant}>
        <Suspense fallback={<PageLoading />}>
          {!workspace.restaurant ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-muted shadow-card">
              No restaurant data found. Please check the Supabase setup and signup trigger.
            </div>
          ) : route.page === "home" ? (
            <DashboardHome restaurant={workspace.restaurant} />
          ) : route.page === "menu" ? (
            <MenuPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "categories" ? (
            <CategoriesPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "tables" ? (
            <TablesPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "kitchen" ? (
            <KitchenPage restaurantId={workspace.restaurant.id} role={workspace.role} />
          ) : route.page === "bills" ? (
            <BillsPage restaurantId={workspace.restaurant.id} role={workspace.role} />
          ) : route.page === "settings" ? (
            <SettingsPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "stats" ? (
            <StatsPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "promotions" ? (
            <PromotionsPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "close-shop" ? (
            <CloseShopPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "audit" ? (
            <AuditPage restaurantId={workspace.restaurant.id} />
          ) : route.page === "feedback" ? (
            <FeedbackPage restaurantId={workspace.restaurant.id} />
          ) : (
            <DashboardHome restaurant={workspace.restaurant} />
          )}
        </Suspense>
      </DashboardLayout>
    );
  }

  return <PublicHome />;
}

function PageLoading() {
  return (
    <main className="min-h-screen bg-canvas p-6 text-sm text-muted">
      Loading...
    </main>
  );
}

function MissingEnvPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 text-ink">
      <section className="max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted">ShopQR</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Supabase env is missing
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Create frontend/.env, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY,
          then restart the Vite dev server.
        </p>
      </section>
    </main>
  );
}

function PublicHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
          Q
        </span>
        QR Menu
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tightest text-ink sm:text-6xl">
          QR Ordering
          <br />
          for your restaurant
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted sm:text-lg">
          Customers scan the table QR, order from the menu, the kitchen sees
          orders in realtime, and staff can settle the whole table in one click.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => go("/signup")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-ink transition hover:bg-ink/85 active:scale-[0.98]"
        >
          Sign up free
        </button>
        <button
          type="button"
          onClick={() => go("/login")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink/30 hover:bg-canvas"
        >
          Login
        </button>
      </div>

      <p className="text-xs text-muted">No credit card required</p>
    </main>
  );
}
