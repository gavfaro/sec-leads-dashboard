"use client";

import { useState } from "react";

export interface ScoreBreakdown {
  vertical: number;
  stage: number;
  check_size: number;
  text: number;
}

export interface MatchResultEntry {
  contactId: string;
  contactName: string;
  role: string | null;
  linkedinUrl: string | null;
  orgId: string;
  orgName: string;
  rank: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface MatchRunEntry {
  id: string;
  startupName: string;
  verticals: string[];
  stage: string | null;
  targetRaise: number | null;
  description: string | null;
  createdAt: string | null;
  results: MatchResultEntry[];
}

const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  vertical: "Vertical",
  stage: "Stage",
  check_size: "Check Size",
  text: "Text",
};

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 w-16 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-zinc-100 border border-black">
        <div
          className="h-full bg-[#10B981]"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-black w-10 text-right tabular-nums">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function RunDetail({ run, onBack }: { run: MatchRunEntry; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-block px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#10B981] transition-none"
      >
        ← All Matches
      </button>

      <div className="border-4 border-black p-6 bg-white">
        <h2 className="text-2xl font-black uppercase tracking-tight">
          {run.startupName}
        </h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {run.stage && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#10B981] px-2 py-0.5 border border-black">
              {run.stage}
            </span>
          )}
          {run.targetRaise && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-zinc-100 px-2 py-0.5 border border-black">
              Target ${run.targetRaise.toLocaleString()}
            </span>
          )}
          {run.verticals.map((v) => (
            <span
              key={v}
              className="text-[9px] font-black uppercase tracking-wider bg-zinc-100 px-2 py-0.5 border border-black"
            >
              {v}
            </span>
          ))}
        </div>
        {run.description && (
          <p className="text-sm text-zinc-600 mt-4 max-w-3xl">{run.description}</p>
        )}
      </div>

      {run.results.length === 0 ? (
        <div className="border-2 border-black p-16 text-center font-black uppercase text-xl text-zinc-400">
          No investors were scored for this run.
        </div>
      ) : (
        <div>
          <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">
            Ranked Investors
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {run.results.map((r) => (
              <div
                key={r.contactId}
                className="border-2 border-black bg-white p-4 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                      #{r.rank}
                    </span>
                    <p className="font-black uppercase text-sm tracking-tight leading-tight">
                      {r.contactName}
                    </p>
                    {r.role && (
                      <span className="text-[9px] font-black uppercase tracking-wider border border-black px-1.5 py-0.5 bg-zinc-100 inline-block mt-1 mb-0.5">
                        {r.role}
                      </span>
                    )}
                    <a
                      href={`/investors/${r.orgId}`}
                      className="block text-[10px] font-bold uppercase text-zinc-500 hover:text-[#10B981] transition-none"
                    >
                      {r.orgName}
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-right">
                      <span className="font-mono font-black text-2xl tabular-nums text-[#10B981] block leading-none">
                        {r.score.toFixed(2)}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                        Score
                      </span>
                    </div>
                    {r.linkedinUrl && (
                      <a
                        href={r.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 border-2 border-black hover:bg-[#10B981] hover:text-white transition-none"
                        aria-label="LinkedIn"
                      >
                        <LinkedInIcon />
                      </a>
                    )}
                  </div>
                </div>
                <div className="border-t border-black pt-2 space-y-1.5">
                  {(Object.keys(BREAKDOWN_LABELS) as (keyof ScoreBreakdown)[]).map(
                    (key) => (
                      <ScoreBar
                        key={key}
                        label={BREAKDOWN_LABELS[key]}
                        value={r.scoreBreakdown?.[key] ?? 0}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchingEngine({ runs }: { runs: MatchRunEntry[] }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  if (selectedRun) {
    return (
      <RunDetail run={selectedRun} onBack={() => setSelectedRunId(null)} />
    );
  }

  return (
    <div className="space-y-6">
      {runs.length === 0 ? (
        <div className="border-2 border-black p-16 text-center font-black uppercase text-xl text-zinc-400">
          No match runs yet.
          <p className="text-sm mt-2 font-bold text-zinc-400">
            Run{" "}
            <span className="font-mono bg-zinc-100 px-2 py-0.5 border border-zinc-300">
              python math_engine/matcher.py --name &quot;Acme&quot; --verticals AI --stage
              Seed --target-raise 2000000 --description &quot;...&quot;
            </span>{" "}
            to create one.
          </p>
        </div>
      ) : (
        <div className="border-2 border-black bg-white overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100 border-b-2 border-black font-black uppercase text-[10px] tracking-tight">
                <th className="p-3 text-left border-r-2 border-black">Startup</th>
                <th className="p-3 text-left border-r-2 border-black">Stage</th>
                <th className="p-3 text-left border-r-2 border-black">Verticals</th>
                <th className="p-3 text-left border-r-2 border-black">Investors Scored</th>
                <th className="p-3 text-left">Run Date</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-zinc-200">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-zinc-50 transition-none">
                  <td className="p-3 border-r-2 border-black font-black uppercase text-xs tracking-tight">
                    <button
                      onClick={() => setSelectedRunId(run.id)}
                      className="hover:text-[#10B981] transition-none text-left"
                    >
                      {run.startupName}
                    </button>
                  </td>
                  <td className="p-3 border-r-2 border-black text-xs text-zinc-600">
                    {run.stage ?? "—"}
                  </td>
                  <td className="p-3 border-r-2 border-black text-xs text-zinc-600">
                    {run.verticals.length ? run.verticals.join(", ") : "—"}
                  </td>
                  <td className="p-3 border-r-2 border-black font-mono font-black text-xs tabular-nums">
                    {run.results.length}
                  </td>
                  <td className="p-3 text-xs text-zinc-500 font-mono">
                    {run.createdAt
                      ? new Date(run.createdAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
