"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocationOption } from "@/lib/world-locations";

type LocationFieldsProps = {
  fromName?: string;
  toName?: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export function LocationFields({
  fromName = "fromCity",
  toName = "toCity",
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: LocationFieldsProps) {
  const [options, setOptions] = useState<LocationOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/locations");
      const payload = (await response.json()) as {
        options?: LocationOption[];
      };
      if (!cancelled) {
        setOptions(payload.options ?? []);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const listId = useMemo(
    () => `loop-locations-${fromName}-${toName}`,
    [fromName, toName],
  );

  return (
    <>
      <datalist id={listId}>
        {options.map((option) => (
          <option
            key={`${option.kind}-${option.isoCode}-${option.label}`}
            value={option.value}
            label={option.label}
          />
        ))}
      </datalist>
      <label className="block text-sm">
        <span className="text-brown">From</span>
        <input
          name={fromName}
          required
          list={listId}
          value={fromValue}
          onChange={(event) => onFromChange(event.target.value)}
          placeholder="City or country"
          autoComplete="off"
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-ink outline-none focus:border-slate-500"
        />
      </label>
      <label className="block text-sm">
        <span className="text-brown">To</span>
        <input
          name={toName}
          required
          list={listId}
          value={toValue}
          onChange={(event) => onToChange(event.target.value)}
          placeholder="City or country"
          autoComplete="off"
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-ink outline-none focus:border-slate-500"
        />
      </label>
    </>
  );
}
