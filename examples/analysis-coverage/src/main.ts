import { createBooking, type BookingInput } from '@/booking';

export function submit(input: BookingInput, notify: (value: BookingInput) => void) {
  const booking = createBooking(input);
  notify(booking);
  setTimeout(() => recordAudit(input.requestId), 0);
  return booking;
}

function recordAudit(requestId: string) {
  return requestId;
}
