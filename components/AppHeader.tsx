"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

export function AppHeader() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 text-ink backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href="/" className="font-serif text-xl tracking-wide">
          Loop
        </Link>
        {isPending ? (
          <span className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
        ) : user ? (
          <Link
            href="/profile"
            className="touch-48 flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 font-serif text-white">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </span>
            <span className="max-w-28 truncate">{user.name}</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="touch-48 inline-flex items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
