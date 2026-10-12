import type { BookingRequest, Reservation } from "./types.js";
import { book, cancel } from "./booking.service.js";

export async function createBooking(input: BookingRequest): Promise<Reservation> {
  if (!input.requestId.trim()) throw new Error("Request identifier required");
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 6) {
    throw new Error("Choose between one and six seats");
  }
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email is invalid");
  return book({ ...input, email });
}

export async function cancelBooking(id: string, email: string): Promise<Reservation> {
  return cancel(id, email.trim().toLowerCase());
}
