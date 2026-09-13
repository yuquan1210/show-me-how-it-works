import { saveOrder } from "../repositories/order";
export function createOrder(customerId: string, items: string[]) {
  return saveOrder({ customerId, items });
}
