"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptPrinter } from "@/components/ReceiptPrinter";
import { readBookingDraft, type BookingDraft } from "@/lib/booking-draft";

export function ConfirmBooking({ busId }: { busId: string }) {
  return <ConfirmFlightBooking flightId={busId} />;
}

export function ConfirmFlightBooking({ flightId }: { flightId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BookingDraft | null>(null);

  useEffect(() => {
    const stored = readBookingDraft();
    const id = stored?.flightId ?? stored?.busId;
    if (!stored || id !== flightId) {
      router.replace(`/search/${flightId}`);
      return;
    }
    setDraft(stored);
  }, [flightId, router]);

  if (!draft) {
    return (
      <main className="px-5 py-10 text-sm text-brown">Preparing ticket…</main>
    );
  }

  return (
    <main className="flex flex-1 flex-col pb-28">
      <section className="px-5 py-8">
        <Link href={`/search/${flightId}`} className="text-sm text-slate-600">
          ← Seats
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-ink">Your ticket</h1>
        <p className="mt-1 text-sm text-brown">
          {draft.fromCity} → {draft.toCity} · {draft.seats.join(", ")} · ₹
          {draft.total}
        </p>
      </section>
      <div className="-mt-4">
        <ReceiptPrinter
          seats={draft.seats}
          total={draft.total}
          unitPrice={draft.unitPrice}
          flightCode={draft.flightCode}
          airline={draft.airline}
          fromCity={draft.fromCity}
          toCity={draft.toCity}
          bulk={draft.bulk}
        />
      </div>
      <div className="mx-auto mt-6 w-full max-w-sm px-4">
        <Link href="/bookings" className="btn-primary flex items-center justify-center">
          View trips
        </Link>
      </div>
    </main>
  );
}
