import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { priceForSelection } from "@/lib/bus-types";
import type {
  BookingRecord,
  BulkGroupView,
  CreateBookingsInput,
  CreateBookingsResult,
  FlightSeatsResponse,
  FlightSummary,
  SeatView,
} from "@/lib/bus-types";

export type {
  BookingRecord,
  BulkGroupView,
  BusSeatsResponse,
  BusSeatView,
  BusSummary,
  CreateBookingsInput,
  CreateBookingsResult,
  FlightSeatsResponse,
  FlightSummary,
  SeatView,
} from "@/lib/bus-types";

type MemoryFlight = FlightSummary & {
  seats: SeatView[];
};

const GUEST_USER_ID = "guest-loop";
const DB_TIMEOUT_MS = 8000;

function dbTimeout() {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("db-timeout")), DB_TIMEOUT_MS);
  });
}

async function tryDb<T>(work: () => Promise<T>): Promise<T | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    return await Promise.race([work(), dbTimeout()]);
  } catch (error) {
    console.error("Database query failed, using fallback.", error);
    return null;
  }
}

function startOfDay(date: string) {
  const utcStart = new Date(`${date}T00:00:00.000Z`);
  const utcEnd = new Date(utcStart);
  utcEnd.setUTCDate(utcEnd.getUTCDate() + 1);
  const localStart = new Date(`${date}T00:00:00`);
  const localEnd = new Date(localStart);
  localEnd.setDate(localEnd.getDate() + 1);
  const start = new Date(Math.min(utcStart.getTime(), localStart.getTime()) - 12 * 60 * 60 * 1000);
  const end = new Date(Math.max(utcEnd.getTime(), localEnd.getTime()) + 12 * 60 * 60 * 1000);
  return { start, end };
}

function toNumber(value: { toString(): string } | number) {
  return typeof value === "number" ? value : Number(value.toString());
}

function groupView(group: {
  id: string;
  fromCity: string;
  destination: string;
  memberCount: number;
  capacity: number;
  unitPrice: { toString(): string } | number;
}): BulkGroupView {
  return {
    id: group.id,
    fromCity: group.fromCity,
    destination: group.destination,
    memberCount: group.memberCount,
    capacity: group.capacity,
    remaining: Math.max(0, group.capacity - group.memberCount),
    unitPrice: toNumber(group.unitPrice),
  };
}

function parseSeatCode(code: string): { row: number; col: number } {
  const match = code.match(/^(\d+)([A-Z])$/i);
  const row = match ? Number(match[1]) : 1;
  const letter = match ? match[2].toUpperCase() : "A";
  const col = Math.max(0, letter.charCodeAt(0) - 65);
  return { row, col };
}

function buildSeatGrid(flightId: string, bookedCodes: string[]): SeatView[] {
  const cols = ["A", "B", "C", "D"];
  const seats: SeatView[] = [];
  for (let row = 1; row <= 10; row += 1) {
    cols.forEach((letter, col) => {
      const code = `${row}${letter}`;
      seats.push({
        id: `${flightId}-${code}`,
        code,
        row,
        col,
        isBooked: bookedCodes.includes(code),
      });
    });
  }
  return seats;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function departureOn(date: string, hours: number, minutes: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function hoursLater(start: Date, hours: number) {
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

function toSummary(
  flight: MemoryFlight | Omit<MemoryFlight, "seats">,
): FlightSummary {
  const { seats: _seats, ...rest } = flight as MemoryFlight;
  return {
    ...rest,
    operator: rest.airline,
  };
}

function applyDate(iso: string, date: string) {
  const original = new Date(iso);
  const next = new Date(`${date}T00:00:00`);
  next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return next.toISOString();
}

function createMemoryFlights(): MemoryFlight[] {
  const date = todayIso();

  const routes: Array<{
    id: string;
    code: string;
    airline: string;
    fromCity: string;
    toCity: string;
    depH: number;
    depM: number;
    durationH: number;
    basePrice: number;
    bulkPrice: number;
    booked: string[];
    group?: Omit<BulkGroupView, "remaining">;
  }> = [
    {
      id: "flt-hyd-lon",
      code: "LP-401",
      airline: "Loop Air",
      fromCity: "Hyderabad",
      toCity: "London",
      depH: 2,
      depM: 15,
      durationH: 10,
      basePrice: 42990,
      bulkPrice: 35990,
      booked: ["1A", "1B", "4C"],
      group: {
        id: "group-hyd-lon",
        fromCity: "Hyderabad",
        destination: "London",
        memberCount: 2,
        capacity: 6,
        unitPrice: 35990,
      },
    },
    {
      id: "flt-lon-nyc",
      code: "LP-218",
      airline: "Loop Atlantic",
      fromCity: "London",
      toCity: "New York",
      depH: 11,
      depM: 40,
      durationH: 8,
      basePrice: 38990,
      bulkPrice: 31990,
      booked: ["2A", "3D"],
      group: {
        id: "group-lon-nyc",
        fromCity: "London",
        destination: "New York",
        memberCount: 3,
        capacity: 8,
        unitPrice: 31990,
      },
    },
    {
      id: "flt-nyc-dxb",
      code: "LP-772",
      airline: "Loop Sky",
      fromCity: "New York",
      toCity: "Dubai",
      depH: 18,
      depM: 5,
      durationH: 13,
      basePrice: 51990,
      bulkPrice: 44990,
      booked: ["5A", "5B", "8C"],
    },
    {
      id: "flt-dxb-tyo",
      code: "LP-090",
      airline: "Loop Pacific",
      fromCity: "Dubai",
      toCity: "Tokyo",
      depH: 9,
      depM: 20,
      durationH: 9.5,
      basePrice: 36490,
      bulkPrice: 29990,
      booked: ["1C"],
      group: {
        id: "group-dxb-tyo",
        fromCity: "Dubai",
        destination: "Tokyo",
        memberCount: 1,
        capacity: 5,
        unitPrice: 29990,
      },
    },
    {
      id: "flt-tyo-sin",
      code: "LP-551",
      airline: "Loop Air",
      fromCity: "Tokyo",
      toCity: "Singapore",
      depH: 14,
      depM: 50,
      durationH: 7,
      basePrice: 24990,
      bulkPrice: 19990,
      booked: ["10A", "10B"],
    },
    {
      id: "flt-sin-par",
      code: "LP-330",
      airline: "Loop Europe",
      fromCity: "Singapore",
      toCity: "Paris",
      depH: 23,
      depM: 10,
      durationH: 13.5,
      basePrice: 47990,
      bulkPrice: 39990,
      booked: ["6D"],
      group: {
        id: "group-sin-par",
        fromCity: "Singapore",
        destination: "Paris",
        memberCount: 4,
        capacity: 8,
        unitPrice: 39990,
      },
    },
    {
      id: "flt-par-hyd",
      code: "LP-119",
      airline: "Loop Air",
      fromCity: "Paris",
      toCity: "Hyderabad",
      depH: 7,
      depM: 0,
      durationH: 9,
      basePrice: 40990,
      bulkPrice: 33990,
      booked: ["3A", "3B"],
    },
  ];

  return routes.map((route) => {
    const departureAt = departureOn(date, route.depH, route.depM);
    const seats = buildSeatGrid(route.id, route.booked);
    const openGroups = route.group
      ? [
          {
            ...route.group,
            remaining: Math.max(0, route.group.capacity - route.group.memberCount),
          },
        ]
      : [];

    return {
      id: route.id,
      code: route.code,
      airline: route.airline,
      operator: route.airline,
      fromCity: route.fromCity,
      toCity: route.toCity,
      departureAt: departureAt.toISOString(),
      arrivalAt: hoursLater(departureAt, route.durationH).toISOString(),
      basePrice: route.basePrice,
      bulkPrice: route.bulkPrice,
      bulkMinSeats: 3,
      availableSeats: seats.filter((seat) => !seat.isBooked).length,
      seats,
      openGroups,
    };
  });
}

const memoryFlights = createMemoryFlights();
const memoryBookings: BookingRecord[] = [];

function matchesCity(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function datedSummary(flight: MemoryFlight, date: string): FlightSummary {
  const { seats: _seats, ...rest } = flight;
  return toSummary({
    ...rest,
    departureAt: applyDate(flight.departureAt, date),
    arrivalAt: applyDate(flight.arrivalAt, date),
    availableSeats: flight.seats.filter((seat) => !seat.isBooked).length,
    openGroups: flight.openGroups.map((group) => ({
      ...group,
      remaining: Math.max(0, group.capacity - group.memberCount),
    })),
  });
}

function memoryFlightById(id: string) {
  return memoryFlights.find((item) => item.id === id);
}

async function searchFromFlightDatabase(
  fromCity: string,
  toCity: string,
  date: string,
): Promise<FlightSummary[] | null> {
  return tryDb(async () => {
    const { start, end } = startOfDay(date);
    const flights = await prisma.flight.findMany({
      where: {
        AND: [
          {
            OR: [
              { route: { origin: { contains: fromCity, mode: "insensitive" } } },
              {
                route: {
                  originCity: { name: { contains: fromCity, mode: "insensitive" } },
                },
              },
              {
                route: {
                  originCity: {
                    country: { name: { contains: fromCity, mode: "insensitive" } },
                  },
                },
              },
            ],
          },
          {
            OR: [
              {
                route: {
                  destination: { contains: toCity, mode: "insensitive" },
                },
              },
              {
                route: {
                  destinationCity: {
                    name: { contains: toCity, mode: "insensitive" },
                  },
                },
              },
              {
                route: {
                  destinationCity: {
                    country: { name: { contains: toCity, mode: "insensitive" } },
                  },
                },
              },
            ],
          },
        ],
        departureAt: { gte: start, lt: end },
      },
      include: {
        route: true,
        plane: true,
        seats: true,
        bulkBookings: { where: { status: "PENDING" } },
      },
      orderBy: { departureAt: "asc" },
    });

    return flights.map((flight) => {
      const openGroups: BulkGroupView[] = flight.bulkBookings.map((group) => {
        const capacity = Math.max(group.passengerCount + 4, 6);
        return {
          id: group.id,
          fromCity: flight.route.origin,
          destination: flight.route.destination,
          memberCount: group.passengerCount,
          capacity,
          remaining: Math.max(0, capacity - group.passengerCount),
          unitPrice: toNumber(group.unitPrice),
        };
      });

      const summary: FlightSummary = {
        id: flight.id,
        code: flight.flightNumber,
        airline: flight.plane.name,
        operator: flight.plane.name,
        fromCity: flight.route.origin,
        toCity: flight.route.destination,
        departureAt: flight.departureAt.toISOString(),
        arrivalAt: flight.arrivalAt.toISOString(),
        basePrice: toNumber(flight.basePrice),
        bulkPrice: toNumber(flight.bulkPrice),
        bulkMinSeats: 3,
        availableSeats: flight.seats.filter((seat) => !seat.isBooked).length,
        openGroups,
      };
      return summary;
    });
  });
}

async function searchFromBusDatabase(
  fromCity: string,
  toCity: string,
  date: string,
): Promise<FlightSummary[] | null> {
  return tryDb(async () => {
    const { start, end } = startOfDay(date);
    const buses = await prisma.bus.findMany({
      where: {
        fromCity: { contains: fromCity, mode: "insensitive" },
        toCity: { contains: toCity, mode: "insensitive" },
        departureAt: { gte: start, lt: end },
      },
      include: {
        seats: true,
        bulkGroups: { where: { status: "OPEN" } },
      },
      orderBy: { departureAt: "asc" },
    });

    return buses.map((bus) => ({
      id: bus.id,
      code: bus.code,
      airline: bus.operator,
      operator: bus.operator,
      fromCity: bus.fromCity,
      toCity: bus.toCity,
      departureAt: bus.departureAt.toISOString(),
      arrivalAt: bus.arrivalAt.toISOString(),
      basePrice: toNumber(bus.basePrice),
      bulkPrice: toNumber(bus.bulkPrice),
      bulkMinSeats: bus.bulkMinSeats,
      availableSeats: bus.seats.filter((seat) => !seat.isBooked).length,
      openGroups: bus.bulkGroups
        .filter((group) => matchesCity(group.destination, toCity))
        .map(groupView),
    }));
  });
}

async function seatsFromFlightDatabase(
  id: string,
): Promise<
  | { source: "db"; data: FlightSeatsResponse | undefined }
  | { source: "unavailable" }
> {
  const result = await tryDb(async () => {
    const flight = await prisma.flight.findUnique({
      where: { id },
      include: {
        route: true,
        plane: true,
        seats: true,
        bulkBookings: { where: { status: "PENDING" } },
      },
    });

    if (!flight) {
      return { source: "db", data: undefined };
    }

    const seats = [...flight.seats]
      .map((seat) => {
        const parsed = parseSeatCode(seat.code);
        return {
          id: seat.id,
          code: seat.code,
          row: parsed.row,
          col: parsed.col,
          isBooked: seat.isBooked,
        };
      })
      .sort((a, b) => a.row - b.row || a.col - b.col);

    const openGroups: BulkGroupView[] = flight.bulkBookings.map((group) => {
      const capacity = Math.max(group.passengerCount + 4, 6);
      return {
        id: group.id,
        fromCity: flight.route.origin,
        destination: flight.route.destination,
        memberCount: group.passengerCount,
        capacity,
        remaining: Math.max(0, capacity - group.passengerCount),
        unitPrice: toNumber(group.unitPrice),
      };
    });

    const summary: FlightSummary = {
      id: flight.id,
      code: flight.flightNumber,
      airline: flight.plane.name,
      operator: flight.plane.name,
      fromCity: flight.route.origin,
      toCity: flight.route.destination,
      departureAt: flight.departureAt.toISOString(),
      arrivalAt: flight.arrivalAt.toISOString(),
      basePrice: toNumber(flight.basePrice),
      bulkPrice: toNumber(flight.bulkPrice),
      bulkMinSeats: 3,
      availableSeats: seats.filter((seat) => !seat.isBooked).length,
      openGroups,
    };

    return {
      source: "db",
      data: { flight: summary, bus: summary, seats, bulkGroups: openGroups },
    };
  });
  return result ?? { source: "unavailable" };
}

async function seatsFromBusDatabase(
  id: string,
): Promise<
  | { source: "db"; data: FlightSeatsResponse | undefined }
  | { source: "unavailable" }
> {
  const result = await tryDb(async () => {
    const bus = await prisma.bus.findUnique({
      where: { id },
      include: {
        seats: { orderBy: [{ row: "asc" }, { col: "asc" }] },
        bulkGroups: { where: { status: "OPEN" } },
      },
    });

    if (!bus) {
      return { source: "db", data: undefined };
    }

    const bulkGroups = bus.bulkGroups.map(groupView);
    const summary: FlightSummary = {
      id: bus.id,
      code: bus.code,
      airline: bus.operator,
      operator: bus.operator,
      fromCity: bus.fromCity,
      toCity: bus.toCity,
      departureAt: bus.departureAt.toISOString(),
      arrivalAt: bus.arrivalAt.toISOString(),
      basePrice: toNumber(bus.basePrice),
      bulkPrice: toNumber(bus.bulkPrice),
      bulkMinSeats: bus.bulkMinSeats,
      availableSeats: bus.seats.filter((seat) => !seat.isBooked).length,
      openGroups: bulkGroups,
    };

    return {
      source: "db",
      data: {
        flight: summary,
        bus: summary,
        seats: bus.seats.map((seat) => ({
          id: seat.id,
          code: seat.code,
          row: seat.row,
          col: seat.col,
          isBooked: seat.isBooked,
        })),
        bulkGroups,
      },
    };
  });
  return result ?? { source: "unavailable" };
}

export async function searchFlights(
  fromCity: string,
  toCity: string,
  date: string,
): Promise<FlightSummary[]> {
  const fromFlights = await searchFromFlightDatabase(fromCity, toCity, date);
  if (fromFlights && fromFlights.length > 0) {
    return fromFlights;
  }

  if (fromFlights) {
    const fromBuses = await searchFromBusDatabase(fromCity, toCity, date);
    if (fromBuses && fromBuses.length > 0) {
      return fromBuses;
    }
    return [];
  }

  return memoryFlights
    .filter(
      (flight) =>
        matchesCity(flight.fromCity, fromCity) &&
        matchesCity(flight.toCity, toCity),
    )
    .map((flight) => datedSummary(flight, date || todayIso()));
}

export async function searchBuses(
  fromCity: string,
  toCity: string,
  date: string,
): Promise<FlightSummary[]> {
  return searchFlights(fromCity, toCity, date);
}

function wrapSeats(flight: MemoryFlight): FlightSeatsResponse {
  const summary = toSummary({
    ...flight,
    availableSeats: flight.seats.filter((seat) => !seat.isBooked).length,
    openGroups: flight.openGroups.map((group) => ({
      ...group,
      remaining: Math.max(0, group.capacity - group.memberCount),
    })),
  });
  const { seats } = flight;
  return {
    flight: summary,
    bus: summary,
    seats,
    bulkGroups: summary.openGroups,
  };
}

export async function getFlightSeats(
  id: string,
): Promise<FlightSeatsResponse | undefined> {
  const fromFlight = await seatsFromFlightDatabase(id);
  if (fromFlight.source === "db" && fromFlight.data) {
    return fromFlight.data;
  }

  if (fromFlight.source === "db") {
    const fromBus = await seatsFromBusDatabase(id);
    if (fromBus.source === "db" && fromBus.data) {
      return fromBus.data;
    }
  }

  const flight = memoryFlightById(id);
  if (!flight) {
    return undefined;
  }
  return wrapSeats(flight);
}

export async function getBusSeats(
  id: string,
): Promise<FlightSeatsResponse | undefined> {
  return getFlightSeats(id);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveUserId(preferred?: string | null) {
  if (preferred) {
    return preferred;
  }
  try {
    const existing = await prisma.user.findUnique({
      where: { email: "guest@loop.app" },
    });
    if (existing) {
      return existing.id;
    }
    const guest = await prisma.user.create({
      data: {
        id: GUEST_USER_ID,
        name: "Guest",
        email: "guest@loop.app",
        emailVerified: false,
      },
    });
    return guest.id;
  } catch {
    return preferred ?? GUEST_USER_ID;
  }
}

async function createBookingsFromFlightDb(
  input: CreateBookingsInput,
  flightId: string,
): Promise<CreateBookingsResult | "unavailable" | "not-found"> {
  if (!isDatabaseConfigured()) {
    return "unavailable";
  }
  try {
    const flight = await Promise.race([
      prisma.flight.findUnique({
        where: { id: flightId },
        include: { route: true, plane: true, seats: true },
      }),
      dbTimeout(),
    ]);
    if (!flight) {
      return "not-found";
    }

    const userId = await resolveUserId(input.userId);
    const bulkBookingId = input.bulkBookingId ?? input.groupId ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: { id: { in: input.seatIds }, flightId },
      });
      if (seats.length !== input.seatIds.length) {
        throw new Error("One or more seats were not found on this flight.");
      }
      if (seats.some((seat) => seat.isBooked)) {
        throw new Error("One or more seats are already booked.");
      }

      const joining = Boolean(bulkBookingId);
      const pricing = priceForSelection({
        selectedCount: seats.length,
        basePrice: toNumber(flight.basePrice),
        bulkPrice: toNumber(flight.bulkPrice),
        bulkMinSeats: 3,
        joiningGroup: joining,
      });

      await tx.seat.updateMany({
        where: { id: { in: input.seatIds } },
        data: { isBooked: true },
      });

      if (bulkBookingId) {
        await tx.bulkBooking.update({
          where: { id: bulkBookingId },
          data: {
            passengerCount: { increment: seats.length },
            totalPrice: { increment: pricing.total },
          },
        });
      }

      const bookedAt = new Date();
      const created = await Promise.all(
        seats.map((seat) =>
          tx.booking.create({
            data: {
              userId,
              seatId: seat.id,
              bookedAt,
              status: "CONFIRMED",
              passengerName: input.passengerName ?? null,
              bulkBookingId,
            },
          }),
        ),
      );

      const summary: FlightSummary = {
        id: flight.id,
        code: flight.flightNumber,
        airline: flight.plane.name,
        operator: flight.plane.name,
        fromCity: flight.route.origin,
        toCity: flight.route.destination,
        departureAt: flight.departureAt.toISOString(),
        arrivalAt: flight.arrivalAt.toISOString(),
        basePrice: toNumber(flight.basePrice),
        bulkPrice: toNumber(flight.bulkPrice),
        bulkMinSeats: 3,
        availableSeats: flight.seats.filter(
          (seat) => !seat.isBooked && !input.seatIds.includes(seat.id),
        ).length,
        openGroups: [],
      };

      const bookings: BookingRecord[] = created.map((booking, index) => ({
        id: booking.id,
        userId,
        flightId: flight.id,
        flightCode: flight.flightNumber,
        airline: flight.plane.name,
        fromCity: flight.route.origin,
        toCity: flight.route.destination,
        seatId: seats[index].id,
        seatCode: seats[index].code,
        passengerName: booking.passengerName,
        bulkBookingId,
        status: "CONFIRMED",
        bookedAt: bookedAt.toISOString(),
        unitPrice: pricing.unitPrice,
      }));

      return {
        bookings,
        seats: seats.map((seat) => seat.code),
        unitPrice: pricing.unitPrice,
        total: pricing.total,
        flight: summary,
        groupId: bulkBookingId,
        bulk: pricing.useBulk,
      } satisfies CreateBookingsResult;
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("already booked")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      throw error;
    }
    return "unavailable";
  }
}

async function createBookingsFromBusDb(
  input: CreateBookingsInput,
  busId: string,
): Promise<CreateBookingsResult | "unavailable" | "not-found"> {
  if (!isDatabaseConfigured()) {
    return "unavailable";
  }
  try {
    const bus = await Promise.race([
      prisma.bus.findUnique({
        where: { id: busId },
        include: { seats: true, bulkGroups: true },
      }),
      dbTimeout(),
    ]);
    if (!bus) {
      return "not-found";
    }

    const userId = await resolveUserId(input.userId);
    const groupId = input.groupId ?? input.bulkBookingId ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const seats = await tx.busSeat.findMany({
        where: { id: { in: input.seatIds }, busId },
      });
      if (seats.length !== input.seatIds.length) {
        throw new Error("One or more seats were not found on this flight.");
      }
      if (seats.some((seat) => seat.isBooked)) {
        throw new Error("One or more seats are already booked.");
      }

      const joining = Boolean(groupId);
      const group = bus.bulkGroups.find((item) => item.id === groupId);
      const pricing = priceForSelection({
        selectedCount: seats.length,
        basePrice: toNumber(bus.basePrice),
        bulkPrice: toNumber(group?.unitPrice ?? bus.bulkPrice),
        bulkMinSeats: bus.bulkMinSeats,
        joiningGroup: joining,
      });

      await tx.busSeat.updateMany({
        where: { id: { in: input.seatIds } },
        data: { isBooked: true },
      });

      if (groupId) {
        await tx.bulkGroup.update({
          where: { id: groupId },
          data: { memberCount: { increment: seats.length } },
        });
      }

      const bookedAt = new Date();
      const bookings: BookingRecord[] = seats.map((seat) => ({
        id: newId("bk"),
        userId,
        flightId: bus.id,
        flightCode: bus.code,
        airline: bus.operator,
        fromCity: bus.fromCity,
        toCity: bus.toCity,
        seatId: seat.id,
        seatCode: seat.code,
        passengerName: input.passengerName ?? null,
        bulkBookingId: groupId,
        status: "CONFIRMED",
        bookedAt: bookedAt.toISOString(),
        unitPrice: pricing.unitPrice,
      }));

      const summary: FlightSummary = {
        id: bus.id,
        code: bus.code,
        airline: bus.operator,
        operator: bus.operator,
        fromCity: bus.fromCity,
        toCity: bus.toCity,
        departureAt: bus.departureAt.toISOString(),
        arrivalAt: bus.arrivalAt.toISOString(),
        basePrice: toNumber(bus.basePrice),
        bulkPrice: toNumber(bus.bulkPrice),
        bulkMinSeats: bus.bulkMinSeats,
        availableSeats: bus.seats.filter(
          (seat) => !seat.isBooked && !input.seatIds.includes(seat.id),
        ).length,
        openGroups: [],
      };

      return {
        bookings,
        seats: seats.map((seat) => seat.code),
        unitPrice: pricing.unitPrice,
        total: pricing.total,
        flight: summary,
        groupId,
        bulk: pricing.useBulk,
      } satisfies CreateBookingsResult;
    });

    memoryBookings.push(...result.bookings);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("already booked")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("not found")) {
      throw error;
    }
    return "unavailable";
  }
}

function createBookingsInMemory(input: CreateBookingsInput): CreateBookingsResult {
  const flightId = input.flightId ?? input.busId;
  if (!flightId) {
    throw new Error("flightId is required.");
  }

  const flight = memoryFlightById(flightId);
  if (!flight) {
    throw new Error("Flight not found.");
  }

  const seats = flight.seats.filter((seat) => input.seatIds.includes(seat.id));
  if (seats.length !== input.seatIds.length) {
    throw new Error("One or more seats were not found on this flight.");
  }
  if (seats.some((seat) => seat.isBooked)) {
    throw new Error("One or more seats are already booked.");
  }

  const groupId = input.groupId ?? input.bulkBookingId ?? null;
  const group = flight.openGroups.find((item) => item.id === groupId) ?? null;
  if (groupId && !group) {
    throw new Error("Group not found.");
  }
  if (group && group.remaining < seats.length) {
    throw new Error("Not enough group seats remaining.");
  }

  const pricing = priceForSelection({
    selectedCount: seats.length,
    basePrice: flight.basePrice,
    bulkPrice: group?.unitPrice ?? flight.bulkPrice,
    bulkMinSeats: flight.bulkMinSeats,
    joiningGroup: Boolean(group),
  });

  const bookedAt = new Date().toISOString();
  const userId = input.userId ?? GUEST_USER_ID;

  for (const seat of seats) {
    seat.isBooked = true;
  }
  flight.availableSeats = flight.seats.filter((seat) => !seat.isBooked).length;

  if (group) {
    group.memberCount += seats.length;
    group.remaining = Math.max(0, group.capacity - group.memberCount);
  }

  const bookings: BookingRecord[] = seats.map((seat) => ({
    id: newId("bk"),
    userId,
    flightId: flight.id,
    flightCode: flight.code,
    airline: flight.airline,
    fromCity: flight.fromCity,
    toCity: flight.toCity,
    seatId: seat.id,
    seatCode: seat.code,
    passengerName: input.passengerName ?? null,
    bulkBookingId: groupId,
    status: "CONFIRMED",
    bookedAt,
    unitPrice: pricing.unitPrice,
  }));

  memoryBookings.push(...bookings);

  return {
    bookings,
    seats: seats.map((seat) => seat.code),
    unitPrice: pricing.unitPrice,
    total: pricing.total,
    flight: toSummary({
      ...flight,
      availableSeats: flight.availableSeats,
    }),
    groupId,
    bulk: pricing.useBulk,
  };
}

export async function createBookings(
  input: CreateBookingsInput,
): Promise<CreateBookingsResult> {
  if (!input.seatIds?.length) {
    throw new Error("Select at least one seat.");
  }

  const flightId = input.flightId ?? input.busId;
  if (!flightId) {
    throw new Error("flightId is required.");
  }

  const fromFlight = await createBookingsFromFlightDb(input, flightId);
  if (fromFlight !== "unavailable" && fromFlight !== "not-found") {
    return fromFlight;
  }

  if (fromFlight === "not-found") {
    const fromBus = await createBookingsFromBusDb(input, flightId);
    if (fromBus !== "unavailable" && fromBus !== "not-found") {
      return fromBus;
    }
  }

  return createBookingsInMemory(input);
}

async function listBookingsFromDatabase(): Promise<BookingRecord[] | null> {
  return tryDb(async () => {
    const rows = await prisma.booking.findMany({
      include: {
        seat: { include: { flight: { include: { route: true, plane: true } } } },
      },
      orderBy: { bookedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      flightId: row.seat.flightId,
      flightCode: row.seat.flight.flightNumber,
      airline: row.seat.flight.plane.name,
      fromCity: row.seat.flight.route.origin,
      toCity: row.seat.flight.route.destination,
      seatId: row.seatId,
      seatCode: row.seat.code,
      passengerName: row.passengerName,
      bulkBookingId: row.bulkBookingId,
      status: row.status,
      bookedAt: row.bookedAt.toISOString(),
      unitPrice: toNumber(row.seat.flight.basePrice),
    }));
  });
}

export async function listBookings(): Promise<BookingRecord[]> {
  const fromDb = await listBookingsFromDatabase();
  if (fromDb) {
    return fromDb;
  }
  return [...memoryBookings].sort((a, b) =>
    a.bookedAt < b.bookedAt ? 1 : -1,
  );
}
