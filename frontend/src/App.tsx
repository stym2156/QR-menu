import { lazy, Suspense, useEffect, useState } from "react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { hasSupabaseEnv } from "./lib/env";
import { parseRoute, type Route } from "./lib/router";
import { useWorkspace } from "./lib/workspace";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from "./pages/Auth/AuthPages";

const BillsPage = lazy(() => import("./pages/Bills/BillsPage").then((m) => ({ default: m.BillsPage })));
const CategoriesPage = lazy(() => import("./pages/Categories/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const AuditPage = lazy(() => import("./pages/Audit/AuditPage").then((m) => ({ default: m.AuditPage })));
const CloseShopPage = lazy(() => import("./pages/CloseShop/CloseShopPage").then((m) => ({ default: m.CloseShopPage })));
const CustomerMenuPage = lazy(() => import("./pages/CustomerMenu/CustomerMenuPage").then((m) => ({ default: m.CustomerMenuPage })));
const DashboardHome = lazy(() => import("./pages/DashboardHome/DashboardHome").then((m) => ({ default: m.DashboardHome })));
const FeedbackPage = lazy(() => import("./pages/Feedback/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const KitchenPage = lazy(() => import("./pages/Kitchen/KitchenPage").then((m) => ({ default: m.KitchenPage })));
const MenuPage = lazy(() => import("./pages/Menu/MenuPage").then((m) => ({ default: m.MenuPage })));
const PromotionsPage = lazy(() => import("./pages/Promotions/PromotionsPage").then((m) => ({ default: m.PromotionsPage })));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const StatsPage = lazy(() => import("./pages/Stats/StatsPage").then((m) => ({ default: m.StatsPage })));
const TablesPage = lazy(() => import("./pages/Tables/TablesPage").then((m) => ({ default: m.TablesPage })));

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
  if (route.name === "forgot-password") return <ForgotPasswordPage />;
  if (route.name === "reset-password") return <ResetPasswordPage />;
  if (route.name === "home") return <LoginPage />;

  if (route.name === "dashboard") {
    if (workspace.loading) return <PageLoading />;
    if (!workspace.userId) return <LoginPage />;

    return (
      <div className="relative min-h-screen overflow-hidden bg-canvas">
        <DecorativeGlows />
        <DashboardLayout role={workspace.role} restaurant={workspace.restaurant}>
          <Suspense fallback={<PageLoading />}>
            {!workspace.restaurant ? (
              <section className="rounded-2xl border border-line bg-surface/90 p-6 text-muted shadow-card">
                No restaurant data found. Please check the Supabase setup and signup trigger.
              </section>
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
      </div>
    );
  }

  return <LoginPage />;
}

function DecorativeGlows() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-48 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-ink/10 blur-3xl" />
      <div className="absolute -left-32 top-20 h-64 w-64 rounded-full bg-ink/8 blur-3xl" />
      <div className="absolute -right-32 bottom-8 h-72 w-72 rounded-full bg-line/45 blur-3xl" />
    </div>
  );
}

function PageLoading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas p-6 text-sm text-muted">
      <section className="w-full max-w-md rounded-3xl border border-line bg-surface/85 p-8 text-center shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">ShopQR</p>
        <h2 className="mt-3 text-xl font-semibold text-ink">Loading your dashboard</h2>
        <div className="mx-auto mt-5 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
        <p className="mt-4 text-sm text-muted">Please wait a moment while data is loading.</p>
      </section>
    </main>
  );
}

function MissingEnvPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-5 py-12 text-ink">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-ink/12 blur-3xl" />
        <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-line/50 blur-3xl" />
      </div>
      <section className="relative z-10 w-full max-w-xl rounded-3xl border border-line bg-surface/90 p-8 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">ShopQR System</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Supabase env is missing</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Create <code>frontend/.env</code>, add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>, then restart the Vite dev server.
        </p>
        <p className="mt-5 rounded-xl border border-line/70 bg-canvas/60 p-4 text-left text-xs text-ink/80">
          These keys are frontend runtime config, so they must be present in Vercel Environment Variables too.
        </p>
      </section>
    </main>
  );
}
