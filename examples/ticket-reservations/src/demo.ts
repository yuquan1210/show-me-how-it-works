import { createBooking, cancelBooking } from "./booking.controller.js";

async function run(): Promise<void> {
  const request = { requestId: "demo-1", email: " Guest@Example.com ", seats: 4, coupon: "WELCOME", paymentToken: "accepted" };
  const reservation = await createBooking(request);
  if (reservation.totalCents !== 8500) throw new Error("Unexpected price");
  const duplicate = await createBooking(request);
  if (duplicate.paymentId !== reservation.paymentId) throw new Error("Duplicate charge");
  try {
    await createBooking({ ...request, requestId: "demo-2", seats: 6, paymentToken: "declined" });
    throw new Error("Expected payment failure");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Payment declined") throw error;
  }
  await createBooking({ ...request, requestId: "demo-3", seats: 6 });
  await cancelBooking(reservation.id, request.email);
  await cancelBooking(reservation.id, request.email);
  console.log("Pricing, duplicate handling, rollback and repeat cancellation passed.");
}

await run();
