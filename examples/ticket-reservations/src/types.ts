export type Reservation = {
  id: string;
  requestId: string;
  email: string;
  seats: number;
  totalCents: number;
  paymentId: string;
  status: "confirmed" | "cancelled";
};

export type BookingRequest = {
  requestId: string;
  email: string;
  seats: number;
  coupon?: string;
  paymentToken: string;
};
