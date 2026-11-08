import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { DEMO_FLIGHT_PAIRS } from "../lib/demo-routes";
import { EXTRA_CITIES, WORLD_COUNTRIES } from "../lib/world-locations";

const DEMO_EMAIL = "demo@loop.app";
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_NAME = "Demo User";

function departureOn(date: Date, hours: number, minutes: number) {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function seatRows() {
  const cols = ["A", "B", "C", "D"];
  const seats: { code: string; isBooked: boolean }[] = [];
  for (let row = 1; row <= 10; row += 1) {
    cols.forEach((letter) => {
      seats.push({
        code: `${row}${letter}`,
        isBooked: false,
      });
    });
  }
  return seats;
}

async function seedCountries() {
  await prisma.country.createMany({
    data: WORLD_COUNTRIES.map((country) => ({
      isoCode: country.isoCode,
      name: country.name,
      capital: country.capital,
    })),
    skipDuplicates: true,
  });

  const countries = await prisma.country.findMany();
  const byIso = new Map(countries.map((country) => [country.isoCode, country]));

  const cityRows: { name: string; countryId: string }[] = [];
  for (const country of WORLD_COUNTRIES) {
    const row = byIso.get(country.isoCode);
    if (!row) {
      continue;
    }
    if (country.capital) {
      cityRows.push({ name: country.capital, countryId: row.id });
    }
  }
  for (const extra of EXTRA_CITIES) {
    const row = byIso.get(extra.isoCode);
    if (row) {
      cityRows.push({ name: extra.name, countryId: row.id });
    }
  }

  const unique = new Map<string, { name: string; countryId: string }>();
  for (const city of cityRows) {
    unique.set(`${city.countryId}:${city.name.toLowerCase()}`, city);
  }

  await prisma.city.createMany({
    data: [...unique.values()],
    skipDuplicates: true,
  });

  console.log(
    `Seeded ${countries.length} countries and ${unique.size} cities.`,
  );
}

async function seedDemoUser() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });

  if (existing) {
    console.log("Demo user already exists.");
    return;
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      name: DEMO_NAME,
    },
  });

  if (!result) {
    throw new Error("Failed to create demo user.");
  }

  console.log("Seeded demo user.");
}

const FLIGHT_FARES: Record<string, { base: number; bulk: number; groupMembers?: number }> =
  {
    "Hyderabad|London": { base: 42990, bulk: 35990, groupMembers: 2 },
    "London|New York": { base: 38990, bulk: 31990, groupMembers: 3 },
    "New York|Dubai": { base: 51990, bulk: 44990 },
    "Dubai|Tokyo": { base: 36490, bulk: 29990, groupMembers: 1 },
    "Tokyo|Singapore": { base: 24990, bulk: 19990 },
    "Singapore|Paris": { base: 47990, bulk: 39990, groupMembers: 4 },
    "Paris|Hyderabad": { base: 40990, bulk: 33990 },
    "Delhi|Dubai": { base: 28990, bulk: 23990, groupMembers: 2 },
    "Mumbai|Singapore": { base: 26990, bulk: 21990, groupMembers: 3 },
    "Sydney|Singapore": { base: 34990, bulk: 28990 },
    "Toronto|London": { base: 41990, bulk: 34990, groupMembers: 2 },
    "Frankfurt|New York": { base: 39990, bulk: 32990 },
  };

async function seedFlights() {
  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const plane = await prisma.plane.upsert({
    where: { code: "A320-LOOP" },
    update: {},
    create: { code: "A320-LOOP", name: "Loop Air", capacity: 40 },
  });

  const cities = await prisma.city.findMany();
  const cityByName = new Map(
    cities.map((city) => [city.name.toLowerCase(), city]),
  );

  for (const [origin, destination] of DEMO_FLIGHT_PAIRS) {
    const fareKey = `${origin}|${destination}`;
    const fares = FLIGHT_FARES[fareKey] ?? { base: 39990, bulk: 32990 };
    const originCity = cityByName.get(origin.toLowerCase());
    const destCity = cityByName.get(destination.toLowerCase());
    const route = await prisma.route.upsert({
      where: {
        origin_destination: { origin, destination },
      },
      update: {
        originCityId: originCity?.id,
        destinationCityId: destCity?.id,
      },
      create: {
        origin,
        destination,
        originCityId: originCity?.id,
        destinationCityId: destCity?.id,
      },
    });

    const departureAt = departureOn(day, 8, 30);
    const flightNumber = `LP-${origin.slice(0, 2).toUpperCase()}${destination.slice(0, 2).toUpperCase()}`;
    const existing = await prisma.flight.findFirst({
      where: { flightNumber, departureAt },
    });

    if (existing) {
      await prisma.flight.update({
        where: { id: existing.id },
        data: {
          basePrice: fares.base,
          bulkPrice: fares.bulk,
        },
      });
      continue;
    }

    await prisma.flight.create({
      data: {
        flightNumber,
        routeId: route.id,
        planeId: plane.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 9 * 60 * 60 * 1000),
        basePrice: fares.base,
        bulkPrice: fares.bulk,
        seats: {
          create: seatRows().map((seat) => ({
            code: seat.code,
            isBooked: ["1A", "1B"].includes(seat.code),
          })),
        },
      },
    });
  }

  console.log("Seeded demo flights.");
}

async function seedBulkGroups() {
  const organizer = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (!organizer) {
    console.log("Skipping bulk groups — demo user missing.");
    return;
  }

  const flights = await prisma.flight.findMany({
    include: { route: true, bulkBookings: true },
  });

  let created = 0;
  for (const flight of flights) {
    const fareKey = `${flight.route.origin}|${flight.route.destination}`;
    const fares = FLIGHT_FARES[fareKey];
    if (!fares?.groupMembers) {
      continue;
    }
    if (flight.bulkBookings.some((group) => group.status === "PENDING")) {
      continue;
    }

    const passengerCount = fares.groupMembers;
    await prisma.bulkBooking.create({
      data: {
        organizerId: organizer.id,
        flightId: flight.id,
        passengerCount,
        unitPrice: fares.bulk,
        totalPrice: fares.bulk * passengerCount,
        status: "PENDING",
      },
    });
    created += 1;
  }

  console.log(`Seeded ${created} open bulk groups.`);
}

async function main() {
  await seedCountries();
  await seedDemoUser();
  await seedFlights();
  await seedBulkGroups();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
