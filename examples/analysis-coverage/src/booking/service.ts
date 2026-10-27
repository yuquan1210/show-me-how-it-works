import { charge } from 'example-payment-sdk';
import { bookings } from './state';
import type { BookingInput } from './types';

class BookingStore {
  constructor(private prefix: string) {}

  save(input: BookingInput) {
    bookings.set(this.prefix + input.requestId, input);
    return input;
  }
}

export function createBooking(input: BookingInput) {
  const store = new BookingStore('reservation:');
  charge(input.seats);
  return store.save(input);
}
