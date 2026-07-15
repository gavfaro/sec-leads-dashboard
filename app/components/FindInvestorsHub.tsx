"use client";

import { useState } from "react";
import FindInvestors, { CompanyEntry } from "./FindInvestors";
import MatchingEngine, { MatchRunEntry } from "./MatchingEngine";

type Mode = "fuzzy" | "match";

export default function FindInvestorsHub({
  companies,
  matchRuns,
  verticals,
}: {
  companies: CompanyEntry[];
  matchRuns: MatchRunEntry[];
  verticals: string[];
}) {
  const [mode, setMode] = useState<Mode>("fuzzy");

  return (
    <div className="space-y-6">
      <div className="inline-flex border-2 border-black bg-white">
        <button
          onClick={() => setMode("fuzzy")}
          className={[
            "px-5 py-2 text-xs font-black uppercase tracking-widest transition-none",
            mode === "fuzzy" ? "bg-[#10B981] text-black" : "hover:bg-zinc-100",
          ].join(" ")}
        >
          Fuzzy Search
        </button>
        <button
          onClick={() => setMode("match")}
          className={[
            "px-5 py-2 text-xs font-black uppercase tracking-widest border-l-2 border-black transition-none",
            mode === "match" ? "bg-[#10B981] text-black" : "hover:bg-zinc-100",
          ].join(" ")}
        >
          Matching Engine
        </button>
      </div>

      {mode === "fuzzy" ? (
        <FindInvestors companies={companies} />
      ) : (
        <MatchingEngine runs={matchRuns} verticals={verticals} />
      )}
    </div>
  );
}
