import { createOrder } from "../services/order";
export async function checkout(customerId: string, items: string[]) {
  if (!items.length) throw new Error("Cart is empty");
  return await createOrder(customerId, items);
}
