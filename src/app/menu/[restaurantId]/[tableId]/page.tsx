import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomerMenuData } from "@/features/customer/menu/queries";
import CustomerOrder from "./CustomerOrder";
import CustomerHeader from "./CustomerHeader";

export const dynamic = "force-dynamic";

type Params = Promise<{ restaurantId: string; tableId: string }>;

export default async function CustomerMenuPage({ params }: { params: Params }) {
  const { restaurantId, tableId } = await params;
  const supabase = await createClient();
  const data = await getCustomerMenuData(supabase, restaurantId, tableId);

  if (!data) notFound();

  return (
    <main className="min-h-screen bg-canvas pb-36">
      <CustomerHeader
        restaurantName={data.restaurant.name}
        tableNumber={data.table.table_number}
        zoneName={data.zoneName}
        shopIsOpen={data.shopIsOpen}
        openTime={data.openTime}
        closeTime={data.closeTime}
        closedReason={data.closedReason}
        tableIsOpen={data.table.is_open ?? false}
      />

      <CustomerOrder
        restaurantId={restaurantId}
        tableId={tableId}
        tableNumber={data.table.table_number}
        menus={data.menus}
        categories={data.categories}
        promotions={data.promotions}
        shopOpen={data.canOrder}
        serviceChargePct={Number(data.restaurant.service_charge_pct) || 0}
        vatPct={Number(data.restaurant.vat_pct) || 0}
      />
    </main>
  );
}
