"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const TABS = [
  { href: "/", label: "SEC Leads" },
  { href: "/investors", label: "Investors" },
  { href: "/find-investors", label: "Find Investors" },
];

export default function Nav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <header className="bg-black sticky top-0 z-50 border-b-4 border-[#10B981]">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="font-black text-xs tracking-[0.3em] uppercase text-[#10B981]">
          Ellerra
        </span>
        <nav className="flex h-full items-stretch">
          {userEmail &&
            TABS.map((tab) => {
              const active =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    "flex items-center px-5 text-[11px] font-black uppercase tracking-widest border-b-4 -mb-1 transition-none",
                    active
                      ? "text-[#10B981] border-[#10B981]"
                      : "text-zinc-500 border-transparent hover:text-zinc-200",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
        </nav>
        <div className="flex items-center gap-3">
          {userEmail ? (
            <>
              <span className="text-[11px] font-bold text-zinc-400 truncate max-w-[160px]">
                {userEmail}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#10B981]"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            pathname !== "/login" &&
            pathname !== "/signup" && (
              <>
                <Link
                  href="/login"
                  className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-[11px] font-black uppercase tracking-widest text-[#10B981] hover:text-white"
                >
                  Sign Up
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
