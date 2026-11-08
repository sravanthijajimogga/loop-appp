import Link from "next/link";

const items = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/bookings", label: "Trips" },
  { href: "/profile", label: "You" },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="touch-48 flex flex-col items-center justify-center gap-0.5 text-xs text-slate-600 hover:text-ink"
            >
              <span className="h-1.5 w-6 rounded-full bg-slate-300" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
