"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "SEC Leads" },
  { href: "/investors", label: "Investors" },
  { href: "/find-investors", label: "Find Investors" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="bg-black sticky top-0 z-50 border-b-4 border-[#10B981]">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="font-black text-xs tracking-[0.3em] uppercase text-[#10B981]">
          Ellerra
        </span>
        <nav className="flex h-full items-stretch">
          {TABS.map((tab) => {
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
      </div>
    </header>
  );
}
