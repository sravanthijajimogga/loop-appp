export type SeatView = {
  id: string;
  code: string;
  row: number;
  col: number;
  isBooked: boolean;
};

/** @deprecated Use SeatView — kept for existing seat map imports. */
export type BusSeatView = SeatView;

export type BulkGroupView = {
  id: string;
  fromCity: string;
  destination: string;
  memberCount: number;
  capacity: number;
  remaining: number;
  unitPrice: number;
};

export type FlightSummary = {
  id: string;
  code: string;
  airline: string;
  fromCity: string;
  toCity: string;
  departureAt: string;
  arrivalAt: string;
  basePrice: number;
  bulkPrice: number;
  bulkMinSeats: number;
  availableSeats: number;
  openGroups: BulkGroupView[];
  /** Compatibility alias for older UI that read operator. */
  operator: string;
};

/** @deprecated Use FlightSummary */
export type BusSummary = FlightSummary;

export type FlightSeatsResponse = {
  flight: FlightSummary;
  seats: SeatView[];
  bulkGroups: BulkGroupView[];
  /** Compatibility alias */
  bus: FlightSummary;
};

/** @deprecated Use FlightSeatsResponse */
export type BusSeatsResponse = FlightSeatsResponse;

export type BookingRecord = {
  id: string;
  userId: string | null;
  flightId: string;
  flightCode: string;
  airline: string;
  fromCity: string;
  toCity: string;
  seatId: string;
  seatCode: string;
  passengerName: string | null;
  bulkBookingId: string | null;
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  bookedAt: string;
  unitPrice: number;
};

export type CreateBookingsInput = {
  seatIds: string[];
  flightId?: string;
  busId?: string;
  groupId?: string | null;
  bulkBookingId?: string | null;
  passengerName?: string | null;
  userId?: string | null;
};

export type CreateBookingsResult = {
  bookings: BookingRecord[];
  seats: string[];
  unitPrice: number;
  total: number;
  flight: FlightSummary;
  groupId: string | null;
  bulk: boolean;
};

export function priceForSelection(options: {
  selectedCount: number;
  basePrice: number;
  bulkPrice: number;
  bulkMinSeats: number;
  joiningGroup: boolean;
}) {
  const useBulk =
    options.joiningGroup || options.selectedCount >= options.bulkMinSeats;
  const unitPrice = useBulk ? options.bulkPrice : options.basePrice;
  return {
    useBulk,
    unitPrice,
    total: unitPrice * options.selectedCount,
  };
}
