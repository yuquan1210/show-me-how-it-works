import type { Reservation } from "./types.js";

const reservations = new Map<string, Reservation>();
let availableSeats = 12;

export function findByRequest(requestId: string): Reservation | undefined {
  return [...reservations.values()].find(item => item.requestId === requestId);
}

export function takeSeats(count: number): void {
  if (count > availableSeats) throw new Error("Not enough seats");
  availableSeats -= count;
}

export function releaseSeats(count: number): void {
  availableSeats += count;
}

export function save(reservation: Reservation): Reservation {
  reservations.set(reservation.id, { ...reservation });
  return { ...reservation };
}

export function findById(id: string): Reservation {
  const reservation = reservations.get(id);
  if (!reservation) throw new Error("Reservation not found");
  return { ...reservation };
}
