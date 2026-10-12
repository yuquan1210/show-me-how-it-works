export function calculateTotal(seats: number, coupon?: string): number {
  const subtotal = seats * 2500;
  const groupPrice = seats >= 4 ? Math.round(subtotal * 0.9) : subtotal;
  if (!coupon) return groupPrice;
  if (coupon !== "WELCOME") throw new Error("Unknown coupon");
  return Math.max(0, groupPrice - 500);
}
