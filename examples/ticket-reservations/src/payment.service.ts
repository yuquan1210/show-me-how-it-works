const payments = new Map<string, number>();
let sequence = 0;

export async function charge(token: string, amountCents: number): Promise<string> {
  if (token === "declined") throw new Error("Payment declined");
  if (!token.trim()) throw new Error("Payment token required");
  const paymentId = `payment-${++sequence}`;
  payments.set(paymentId, amountCents);
  return paymentId;
}

export async function refund(paymentId: string): Promise<void> {
  if (!payments.has(paymentId)) throw new Error("Payment not found");
  payments.delete(paymentId);
}
