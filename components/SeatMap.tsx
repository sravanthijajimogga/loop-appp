"use client";

import type { SeatView } from "@/lib/bus-types";

type SeatMapProps = {
  seats: SeatView[];
  selectedIds: string[];
  onToggle: (seat: SeatView) => void;
};

function seatClassName(seat: SeatView, selected: boolean) {
  if (seat.isBooked) {
    return "cursor-not-allowed bg-slate-200 text-slate-400";
  }
  if (selected) {
    return "scale-105 bg-slate-800 text-white shadow-md";
  }
  return "bg-sky-50 text-slate-800 hover:bg-sky-100";
}

export function SeatMap({ seats, selectedIds, onToggle }: SeatMapProps) {
  const rows = [...new Set(seats.map((seat) => seat.row))].sort(
    (a, b) => a - b,
  );

  return (
    <div className="space-y-3">
      <div className="text-center text-sm uppercase tracking-[0.3em] text-slate-500">
        Nose
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const rowSeats = seats
            .filter((seat) => seat.row === row)
            .sort((a, b) => a.col - b.col);

          return (
            <div
              key={row}
              className="grid grid-cols-[1.5rem_repeat(2,3rem)_0.75rem_repeat(2,3rem)] items-center justify-center gap-1"
            >
              <span className="text-xs text-brown">{row}</span>
              {rowSeats.slice(0, 2).map((seat) => (
                <SeatButton
                  key={seat.id}
                  seat={seat}
                  selected={selectedIds.includes(seat.id)}
                  className={seatClassName(seat, selectedIds.includes(seat.id))}
                  onToggle={onToggle}
                />
              ))}
              <span aria-hidden className="h-12 rounded-sm bg-slate-100" />
              {rowSeats.slice(2).map((seat) => (
                <SeatButton
                  key={seat.id}
                  seat={seat}
                  selected={selectedIds.includes(seat.id)}
                  className={seatClassName(seat, selectedIds.includes(seat.id))}
                  onToggle={onToggle}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-brown">
        <Legend color="bg-sky-50" label="Available" />
        <Legend color="bg-slate-800" label="Selected" />
        <Legend color="bg-slate-200" label="Booked" />
      </div>
    </div>
  );
}

function SeatButton({
  seat,
  selected,
  className,
  onToggle,
}: {
  seat: SeatView;
  selected: boolean;
  className: string;
  onToggle: (seat: SeatView) => void;
}) {
  return (
    <button
      type="button"
      disabled={seat.isBooked}
      aria-pressed={selected}
      onClick={() => onToggle(seat)}
      className={`touch-48 h-12 rounded-xl text-xs font-semibold transition-transform duration-150 ${className}`}
    >
      {seat.code}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded border border-slate-200 ${color}`} />
      {label}
    </span>
  );
}
