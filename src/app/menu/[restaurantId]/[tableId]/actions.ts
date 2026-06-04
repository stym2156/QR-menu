"use server";

import {
  callStaff as callStaffAction,
  placeOrder as placeOrderAction,
  type CallStaffResult,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from "@/features/customer/orders/actions";

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  return placeOrderAction(input);
}

export async function callStaff(input: {
  restaurantId: string;
  tableId: string;
  reason: string | null;
}): Promise<CallStaffResult> {
  return callStaffAction(input);
}
