"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeatMap } from "@/components/SeatMap";
import { saveBookingDraft } from "@/lib/booking-draft";
import {
  priceForSelection,
  type FlightSeatsResponse,
  type SeatView,
} from "@/lib/bus-types";

export function BusSeatPicker({ id }: { id: string }) {
  return <FlightSeatPicker id={id} />;
}

export function FlightSeatPicker({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<FlightSeatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/flights/${id}/seats`);
      const payload = (await response.json()) as FlightSeatsResponse & {
        error?: string;
      };
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(payload.error ?? "Could not load seats.");
        return;
      }
      setData(payload);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flight = data?.flight ?? data?.bus;
  const openGroups = data?.bulkGroups ?? flight?.openGroups ?? [];
  const selectedGroup =
    openGroups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedSeats = useMemo(
    () => data?.seats.filter((seat) => selectedIds.includes(seat.id)) ?? [],
    [data, selectedIds],
  );

  const pricing = flight
    ? priceForSelection({
        selectedCount: selectedSeats.length,
        basePrice: flight.basePrice,
        bulkPrice: selectedGroup?.unitPrice ?? flight.bulkPrice,
        bulkMinSeats: flight.bulkMinSeats,
        joiningGroup: Boolean(selectedGroup),
      })
    : null;

  function toggleSeat(seat: SeatView) {
    if (seat.isBooked) {
      return;
    }
    setSelectedIds((current) =>
      current.includes(seat.id)
        ? current.filter((value) => value !== seat.id)
        : [...current, seat.id],
    );
  }

  async function proceed() {
    if (!flight || !data || !pricing || selectedSeats.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatIds: selectedIds,
          flightId: flight.id,
          groupId: selectedGroupId,
          bulkBookingId: selectedGroupId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        bookings?: { id: string }[];
        seats?: string[];
        unitPrice?: number;
        total?: number;
        bulk?: boolean;
        groupId?: string | null;
      };

      if (!response.ok) {
        setError(payload.error ?? "Could not book seats.");
        setSubmitting(false);
        return;
      }

      saveBookingDraft({
        flightId: flight.id,
        flightCode: flight.code,
        fromCity: flight.fromCity,
        toCity: flight.toCity,
        airline: flight.airline,
        seats: payload.seats ?? selectedSeats.map((seat) => seat.code),
        seatIds: selectedIds,
        unitPrice: payload.unitPrice ?? pricing.unitPrice,
        total: payload.total ?? pricing.total,
        bulk: Boolean(payload.bulk ?? pricing.useBulk),
        groupId: payload.groupId ?? selectedGroupId,
        bookingIds: payload.bookings?.map((booking) => booking.id) ?? [],
        busId: flight.id,
        busCode: flight.code,
        operator: flight.airline,
      });
      router.push(`/search/${id}/confirm`);
    } catch {
      setError("Could not book seats.");
      setSubmitting(false);
    }
  }

  if (error && !data) {
    return (
      <main className="px-5 py-10 text-sm text-maroon">
        {error}{" "}
        <Link href="/search" className="underline">
          Back to search
        </Link>
      </main>
    );
  }

  if (!data || !flight || !pricing) {
    return (
      <main className="px-5 py-10 text-sm text-brown">Loading seats…</main>
    );
  }

  return (
    <main className="flex flex-1 flex-col pb-28">
      <section className="px-5 py-6">
        <Link href="/search" className="text-sm text-slate-600">
          ← Flights
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-ink">
          {flight.fromCity} → {flight.toCity}
        </h1>
        <p className="text-sm text-brown">
          {flight.code} · {flight.airline}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Solo ₹{flight.basePrice} · Bulk from ₹{flight.bulkPrice} when you join
          a group or book {flight.bulkMinSeats}+ seats
        </p>
      </section>

      {openGroups.length > 0 ? (
        <section className="space-y-3 px-4">
          <h2 className="px-1 font-serif text-xl text-ink">Open groups</h2>
          {openGroups.map((group) => {
            const active = selectedGroupId === group.id;
            const full = group.remaining <= 0;
            return (
              <button
                key={group.id}
                type="button"
                disabled={full}
                onClick={() =>
                  setSelectedGroupId((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                className={`jaali-card w-full rounded-3xl p-4 text-left transition ${
                  active
                    ? "border-sky-500 ring-2 ring-sky-200"
                    : "border-slate-200"
                } ${full ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg text-ink">
                      {group.fromCity} → {group.destination}
                    </p>
                    <p className="text-sm text-brown">
                      {group.memberCount}/{group.capacity} joined ·{" "}
                      {group.remaining} spots left
                    </p>
                  </div>
                  <p className="font-serif text-xl text-ink">₹{group.unitPrice}</p>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {full
                    ? "Group is full"
                    : active
                      ? "Joined — bulk fare locked"
                      : "Tap to join this bulk booking"}
                </p>
              </button>
            );
          })}
        </section>
      ) : null}

      {error ? <p className="px-5 pt-3 text-sm text-maroon">{error}</p> : null}

      <div className="jaali-card mx-4 mt-4 rounded-3xl p-4">
        <SeatMap
          seats={data.seats}
          selectedIds={selectedIds}
          onToggle={toggleSeat}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto w-full max-w-lg px-4">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-brown">
              {selectedSeats.length === 0
                ? "Pick a seat to continue"
                : selectedSeats.map((seat) => seat.code).join(", ")}
              {pricing.useBulk ? " · Bulk fare" : ""}
            </p>
            <p className="font-serif text-xl text-ink">₹{pricing.total}</p>
          </div>
          <button
            type="button"
            disabled={selectedSeats.length === 0 || submitting}
            onClick={() => void proceed()}
            className="btn-primary min-w-[44%] px-5"
          >
            {submitting ? "Booking…" : "Proceed"}
          </button>
        </div>
      </div>
    </main>
  );
}
