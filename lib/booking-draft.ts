export const BOOKING_DRAFT_KEY = "loop-booking-draft";

export type BookingDraft = {
  flightId: string;
  flightCode: string;
  fromCity: string;
  toCity: string;
  airline: string;
  seats: string[];
  seatIds: string[];
  unitPrice: number;
  total: number;
  bulk: boolean;
  groupId: string | null;
  bookingIds: string[];
  /** Compatibility aliases */
  busId: string;
  busCode: string;
  operator: string;
};

export function saveBookingDraft(draft: BookingDraft) {
  sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
}

export function readBookingDraft(): BookingDraft | null {
  const raw = sessionStorage.getItem(BOOKING_DRAFT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BookingDraft>;
    const flightId = parsed.flightId ?? parsed.busId;
    const flightCode = parsed.flightCode ?? parsed.busCode;
    if (!flightId || !flightCode) {
      return null;
    }
    const airline = parsed.airline ?? parsed.operator ?? "Loop Air";
    return {
      flightId,
      flightCode,
      fromCity: parsed.fromCity ?? "",
      toCity: parsed.toCity ?? "",
      airline,
      seats: parsed.seats ?? [],
      seatIds: parsed.seatIds ?? [],
      unitPrice: parsed.unitPrice ?? 0,
      total: parsed.total ?? 0,
      bulk: Boolean(parsed.bulk),
      groupId: parsed.groupId ?? null,
      bookingIds: parsed.bookingIds ?? [],
      busId: parsed.busId ?? flightId,
      busCode: parsed.busCode ?? flightCode,
      operator: parsed.operator ?? airline,
    };
  } catch {
    return null;
  }
}
