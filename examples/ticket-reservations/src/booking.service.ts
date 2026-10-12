import type { BookingRequest, Reservation } from "./types.js";
import { findByRequest, findById, takeSeats, releaseSeats, save } from "./reservation.repository.js";
import { calculateTotal } from "./pricing.service.js";
import { charge, refund } from "./payment.service.js";

export async function book(request: BookingRequest): Promise<Reservation> {
  const previous = findByRequest(request.requestId);
  if (previous) return previous;
  const totalCents = calculateTotal(request.seats, request.coupon);
  takeSeats(request.seats);
  let paymentId: string;
  try {
    paymentId = await charge(request.paymentToken, totalCents);
  } catch (error) {
    releaseSeats(request.seats);
    throw error;
  }
  return save({
    id: `reservation-${request.requestId}`,
    requestId: request.requestId,
    email: request.email,
    seats: request.seats,
    totalCents,
    paymentId,
    status: "confirmed"
  });
}

export async function cancel(id: string, email: string): Promise<Reservation> {
  const reservation = findById(id);
  if (reservation.email !== email) throw new Error("Reservation owner mismatch");
  if (reservation.status === "cancelled") return reservation;
  await refund(reservation.paymentId);
  releaseSeats(reservation.seats);
  return save({ ...reservation, status: "cancelled" });
}
