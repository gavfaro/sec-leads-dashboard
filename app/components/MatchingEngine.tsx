"use client";

import { useMemo, useState } from "react";
import {
  ContactInvestment,
  ContactWithInvestments,
  LinkedInIcon,
  PartnerModal,
  SimilarCompany,
} from "./PartnerModal";
import ExportMatchButton from "./ExportMatchButton";

// Mirrors math_engine/investor_encoder.py's STAGE_VOCABULARY -- not stored in the
// database, so kept in sync by hand.
const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth"];

// Mirrors lib/matching/matcher.ts's DEFAULT_WEIGHTS and companySimilarity.ts's
// DEFAULT_SIMILARITY_THRESHOLD -- not imported directly since those live in
// server-only matching code, so kept in sync by hand (same as STAGE_OPTIONS).
const DEFAULT_MATCH_WEIGHTS: Record<"vertical" | "stage" | "check_size" | "text", number> = {
  vertical: 0.3,
  stage: 0.25,
  check_size: 0.2,
  text: 0.25,
};
const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

export interface ScoreBreakdown {
  vertical: number;
  stage: number;
  check_size: number;
  text: number;
  similar_companies?: SimilarCompany[];
  bio_similarity?: number | null;
}

type NumericBreakdownKey = "vertical" | "stage" | "check_size" | "text";

export interface MatchResultEntry {
  contactId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  email: string | null;
  twitter: string | null;
  location: string | null;
  accreditationVerified: boolean;
  investments: ContactInvestment[];
  orgId: string;
  orgName: string;
  orgWebsite: string | null;
  orgAum: number | null;
  orgType: string | null;
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
  weightsUsed: Record<string, number>;
  similarityThreshold: number;
  results: MatchResultEntry[];
}

const BREAKDOWN_LABELS: Record<NumericBreakdownKey, string> = {
  vertical: "Vertical",
  stage: "Stage",
  check_size: "Check Size",
  text: "Text",
};

// The text score is a diminishing-returns squash of these companies' similarity
// (see companySimilarity.ts's saturate()), so 5+ relevant companies is already
// deep into that curve -- a bar fill past that point wouldn't add information.
const SIMILAR_COMPANIES_BAR_CAP = 5;

function ScoreBar({
  label,
  value,
  displayValue,
}: {
  label: string;
  value: number;
  displayValue?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 w-16 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 bg-zinc-100 border border-black">
        <div
          className="h-full bg-[#2596BE]"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-black w-10 text-right tabular-nums">
        {displayValue ?? value.toFixed(2)}
      </span>
    </div>
  );
}

function toContactWithInvestments(r: MatchResultEntry): ContactWithInvestments {
  return {
    id: r.contactId,
    first_name: r.firstName,
    last_name: r.lastName,
    role: r.role,
    linkedin_url: r.linkedinUrl,
    bio: r.bio,
    contact_investments: r.investments,
  };
}

// Rough proxy for "who to lead with" when several contacts tie exactly (see
// below) -- not a real org chart, just enough to prefer a Partner over an
// Associate when the underlying data can't otherwise tell them apart.
function seniorityRank(role: string | null): number {
  const r = (role ?? "").toLowerCase();
  if (r.includes("founder") || r.includes("managing partner")) return 0;
  if (r.includes("general partner") || /\bpartner\b/.test(r)) return 1;
  if (r.includes("principal")) return 2;
  if (r.includes("director") || r.includes("vice president") || /\bvp\b/.test(r)) return 3;
  return 4;
}

interface ResultGroup {
  key: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  members: MatchResultEntry[]; // best-first
}

// Firms that syndicate every deal across their whole team (Alumni Ventures is
// the clearest case in our data) give every partner the exact same
// contact_investments -- since every score component is a pure function of
// that data (see encoder.ts), those partners get byte-identical scores and
// flood the top of the list with what look like duplicate recommendations.
// Grouping by (org, full score breakdown) collapses them into one slot without
// hiding anyone -- every member is still individually clickable, since bios
// (and thus which one is worth reaching out to first) still differ.
function groupDuplicateProfiles(results: MatchResultEntry[]): ResultGroup[] {
  const groups = new Map<string, MatchResultEntry[]>();
  for (const r of results) {
    const key = `${r.orgId}::${JSON.stringify(r.scoreBreakdown)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const result: ResultGroup[] = [...groups.entries()].map(([key, members]) => {
    const sorted = [...members].sort((a, b) => {
      const seniorityDiff = seniorityRank(a.role) - seniorityRank(b.role);
      if (seniorityDiff !== 0) return seniorityDiff;
      if (Boolean(a.linkedinUrl) !== Boolean(b.linkedinUrl)) {
        return a.linkedinUrl ? -1 : 1;
      }
      return a.rank - b.rank;
    });
    return { key, score: sorted[0].score, scoreBreakdown: sorted[0].scoreBreakdown, members: sorted };
  });

  result.sort((a, b) => b.score - a.score);
  return result;
}

function RunDetail({
  run,
  onBack,
  onDelete,
  deleting,
}: {
  run: MatchRunEntry;
  onBack: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [selectedContact, setSelectedContact] = useState<MatchResultEntry | null>(null);
  const groupedResults = useMemo(() => groupDuplicateProfiles(run.results), [run.results]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="inline-block px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
        >
          ← All Matches
        </button>
        <div className="flex gap-2">
          <ExportMatchButton run={run} />
          <button
            onClick={onDelete}
            disabled={deleting}
            className="px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-red-600 hover:text-white transition-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting…" : "Delete Match"}
          </button>
        </div>
      </div>

      <div className="border-4 border-black p-6 bg-white">
        <h2 className="text-2xl font-black uppercase tracking-tight">
          {run.startupName}
        </h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {run.stage && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#2596BE] px-2 py-0.5 border border-black">
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
        <div className="mt-4 pt-3 border-t border-zinc-200 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
          <span>
            Weights: Vertical {Math.round((run.weightsUsed.vertical ?? 0) * 100)}% · Stage{" "}
            {Math.round((run.weightsUsed.stage ?? 0) * 100)}% · Check Size{" "}
            {Math.round((run.weightsUsed.check_size ?? 0) * 100)}% · Text{" "}
            {Math.round((run.weightsUsed.text ?? 0) * 100)}%
          </span>
          <span>Similarity Threshold: {run.similarityThreshold.toFixed(2)}</span>
        </div>
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
            {groupedResults.map((group, i) => {
              const r = group.members[0];
              const others = group.members.slice(1);
              return (
                <div
                  key={group.key}
                  className="border-2 border-black bg-white p-4 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                        #{i + 1}
                      </span>
                      <button
                        onClick={() => setSelectedContact(r)}
                        className="block text-left font-black uppercase text-sm tracking-tight leading-tight hover:text-[#2596BE] transition-none"
                      >
                        {r.firstName} {r.lastName}
                      </button>
                      {r.role && (
                        <span className="text-[9px] font-black uppercase tracking-wider border border-black px-1.5 py-0.5 bg-zinc-100 inline-block mt-1 mb-0.5">
                          {r.role}
                        </span>
                      )}
                      <a
                        href={`/investors/${r.orgId}`}
                        className="block text-[10px] font-bold uppercase text-zinc-500 hover:text-[#2596BE] transition-none"
                      >
                        {r.orgName}
                      </a>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-right">
                        <span className="font-mono font-black text-2xl tabular-nums text-[#2596BE] block leading-none">
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
                          className="p-1.5 border-2 border-black hover:bg-[#2596BE] hover:text-white transition-none"
                          aria-label="LinkedIn"
                        >
                          <LinkedInIcon />
                        </a>
                      )}
                    </div>
                  </div>

                  {others.length > 0 && (
                    <div className="border-t border-zinc-200 pt-2">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mb-1">
                        Same profile also matches {others.length} more at {r.orgName}:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {others.map((o) => (
                          <button
                            key={o.contactId}
                            onClick={() => setSelectedContact(o)}
                            title="View this contact's own bio"
                            className="text-[10px] font-bold border border-zinc-300 px-2 py-0.5 bg-zinc-50 text-zinc-500 hover:bg-zinc-200 transition-none"
                          >
                            {o.firstName} {o.lastName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-black pt-2 space-y-1.5">
                    {(Object.keys(BREAKDOWN_LABELS) as NumericBreakdownKey[]).map(
                      (key) => (
                        <ScoreBar
                          key={key}
                          label={BREAKDOWN_LABELS[key]}
                          value={group.scoreBreakdown?.[key] ?? 0}
                        />
                      ),
                    )}
                    <ScoreBar
                      label="Similar Cos"
                      value={
                        (group.scoreBreakdown?.similar_companies?.length ?? 0) /
                        SIMILAR_COMPANIES_BAR_CAP
                      }
                      displayValue={String(group.scoreBreakdown?.similar_companies?.length ?? 0)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedContact && (
        <PartnerModal
          partner={toContactWithInvestments(selectedContact)}
          onClose={() => setSelectedContact(null)}
          similarCompanies={selectedContact.scoreBreakdown.similar_companies}
          bioSimilarity={selectedContact.scoreBreakdown.bio_similarity}
        />
      )}
    </div>
  );
}

function NewMatchForm({
  verticals,
  onCreated,
  onCancel,
}: {
  verticals: string[];
  onCreated: (run: MatchRunEntry) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [customVertical, setCustomVertical] = useState("");
  const [stage, setStage] = useState("");
  const [targetRaise, setTargetRaise] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [verticalWeight, setVerticalWeight] = useState(DEFAULT_MATCH_WEIGHTS.vertical);
  const [stageWeight, setStageWeight] = useState(DEFAULT_MATCH_WEIGHTS.stage);
  const [checkSizeWeight, setCheckSizeWeight] = useState(DEFAULT_MATCH_WEIGHTS.check_size);
  const [textWeight, setTextWeight] = useState(DEFAULT_MATCH_WEIGHTS.text);
  const [similarityThreshold, setSimilarityThreshold] = useState(DEFAULT_SIMILARITY_THRESHOLD);

  function resetSettings() {
    setVerticalWeight(DEFAULT_MATCH_WEIGHTS.vertical);
    setStageWeight(DEFAULT_MATCH_WEIGHTS.stage);
    setCheckSizeWeight(DEFAULT_MATCH_WEIGHTS.check_size);
    setTextWeight(DEFAULT_MATCH_WEIGHTS.text);
    setSimilarityThreshold(DEFAULT_SIMILARITY_THRESHOLD);
  }

  function toggleVertical(v: string) {
    setSelectedVerticals((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  // The vertical vocabulary is scraped and highly fragmented (hundreds of tags --
  // see lib/matching's vertical-embedding comments), so showing all of them as
  // buttons at once is overwhelming. Cap the visible suggestions and reuse the
  // "type a custom vertical" box to filter them down as well.
  const VERTICAL_SUGGESTION_LIMIT = 12;
  const availableVerticals = verticals.filter((v) => !selectedVerticals.includes(v));
  const filteredVerticals = customVertical.trim()
    ? availableVerticals.filter((v) =>
        v.toLowerCase().includes(customVertical.trim().toLowerCase()),
      )
    : availableVerticals;
  const visibleVerticals = filteredVerticals.slice(0, VERTICAL_SUGGESTION_LIMIT);
  const hiddenVerticalCount = filteredVerticals.length - visibleVerticals.length;

  function addCustomVertical() {
    const v = customVertical.trim();
    if (v && !selectedVerticals.includes(v)) {
      setSelectedVerticals((prev) => [...prev, v]);
    }
    setCustomVertical("");
  }

  function handleCustomVerticalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomVertical();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          verticals: selectedVerticals,
          stage: stage || undefined,
          targetRaise: targetRaise ? Number(targetRaise) : undefined,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          weights: {
            vertical: verticalWeight,
            stage: stageWeight,
            check_size: checkSizeWeight,
            text: textWeight,
          },
          similarityThreshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Match failed to run.");
      }
      onCreated(data.run as MatchRunEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-4 border-black p-6 bg-white space-y-4"
    >
      <div className="flex justify-between items-start gap-4">
        <h2 className="text-xl font-black uppercase tracking-tight">New Match</h2>
        <button
          type="button"
          onClick={onCancel}
          className="border-2 border-black px-3 py-1 font-black text-xs hover:bg-black hover:text-white transition-none"
        >
          ✕ Cancel
        </button>
      </div>

      <div>
        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
          Startup Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
            Stage
          </label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full border-2 border-black p-2 text-sm font-sans bg-white focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
          >
            <option value="">—</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
            Target Raise ($)
          </label>
          <input
            type="number"
            min="0"
            value={targetRaise}
            onChange={(e) => setTargetRaise(e.target.value)}
            placeholder="e.g. 5000000"
            className="w-full border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
          />
        </div>
      </div>

      <div>
        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
          Verticals
        </label>

        {selectedVerticals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedVerticals.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVertical(v)}
                title="Click to remove"
                className="text-[10px] font-bold border-2 border-black px-2 py-1 bg-[#2596BE] hover:bg-red-500 hover:text-white transition-none"
              >
                {v} ✕
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={customVertical}
            onChange={(e) => setCustomVertical(e.target.value)}
            onKeyDown={handleCustomVerticalKeyDown}
            placeholder="Filter or type a custom vertical and press Enter…"
            className="flex-1 border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
          />
          <button
            type="button"
            onClick={addCustomVertical}
            className="border-2 border-black px-4 font-black text-xs uppercase hover:bg-zinc-100 transition-none"
          >
            Add
          </button>
        </div>

        {visibleVerticals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleVerticals.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVertical(v)}
                className="text-[10px] font-bold border-2 border-black px-2 py-1 bg-white hover:bg-zinc-100 transition-none"
              >
                + {v}
              </button>
            ))}
          </div>
        )}
        {hiddenVerticalCount > 0 && (
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mt-1.5">
            +{hiddenVerticalCount} more — keep typing above to narrow down
          </p>
        )}
      </div>

      <div>
        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. San Francisco, CA"
          className="w-full border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
        />
      </div>

      <div>
        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What does the startup do?"
          className="w-full border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
        />
      </div>

      <div className="border-t-2 border-black pt-4">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-black transition-none"
        >
          {showSettings ? "▾" : "▸"} Match Settings (Advanced)
        </button>

        {showSettings && (
          <div className="mt-3 space-y-4 border-2 border-black p-4 bg-zinc-50">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                Feature Weights
              </p>
              <p className="text-[10px] text-zinc-400 mb-2">
                Relative importance of each signal — automatically normalized to sum to 100%.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                    Vertical
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={verticalWeight}
                    onChange={(e) => setVerticalWeight(Number(e.target.value))}
                    className="w-full border-2 border-black p-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                    Stage
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={stageWeight}
                    onChange={(e) => setStageWeight(Number(e.target.value))}
                    className="w-full border-2 border-black p-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                    Check Size
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={checkSizeWeight}
                    onChange={(e) => setCheckSizeWeight(Number(e.target.value))}
                    className="w-full border-2 border-black p-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                    Text
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={textWeight}
                    onChange={(e) => setTextWeight(Number(e.target.value))}
                    className="w-full border-2 border-black p-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Similar Company Threshold
              </label>
              <p className="text-[10px] text-zinc-400 mb-2">
                Minimum similarity (0–1) for a portfolio company to count as &quot;similar&quot;
                toward an investor&apos;s text score.
              </p>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="w-32 border-2 border-black p-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2596BE]"
              />
            </div>

            <button
              type="button"
              onClick={resetSettings}
              className="text-[10px] font-bold uppercase border border-black px-2 py-1 hover:bg-zinc-200 transition-none"
            >
              Reset to Defaults
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-bold text-red-600 uppercase tracking-wide">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="px-5 py-2 border-2 border-black font-black text-xs uppercase tracking-widest bg-[#2596BE] hover:bg-black hover:text-white transition-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Matching…" : "Run Match"}
      </button>
    </form>
  );
}

export default function MatchingEngine({
  runs: initialRuns,
  verticals,
}: {
  runs: MatchRunEntry[];
  verticals: string[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  async function handleDelete(runId: string) {
    if (!confirm("Delete this match run? This can't be undone.")) return;
    setDeletingId(runId);
    try {
      const res = await fetch(`/api/match/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete match.");
      }
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRunId === runId) setSelectedRunId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete match.");
    } finally {
      setDeletingId(null);
    }
  }

  if (selectedRun) {
    return (
      <RunDetail
        run={selectedRun}
        onBack={() => setSelectedRunId(null)}
        onDelete={() => handleDelete(selectedRun.id)}
        deleting={deletingId === selectedRun.id}
      />
    );
  }

  if (showForm) {
    return (
      <NewMatchForm
        verticals={verticals}
        onCancel={() => setShowForm(false)}
        onCreated={(run) => {
          setRuns((prev) => [run, ...prev]);
          setShowForm(false);
          setSelectedRunId(run.id);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowForm(true)}
        className="px-5 py-2 border-2 border-black font-black text-xs uppercase tracking-widest bg-[#2596BE] hover:bg-black hover:text-white transition-none"
      >
        + New Match
      </button>

      {runs.length === 0 ? (
        <div className="border-2 border-black p-16 text-center font-black uppercase text-xl text-zinc-400">
          No match runs yet.
          <p className="text-sm mt-2 font-bold text-zinc-400">
            Click &quot;+ New Match&quot; above, or run{" "}
            <span className="font-mono bg-zinc-100 px-2 py-0.5 border border-zinc-300">
              python math_engine/matcher.py --name &quot;Acme&quot; --verticals AI --stage
              Seed --target-raise 2000000 --description &quot;...&quot;
            </span>{" "}
            from the CLI.
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
                <th className="p-3 text-left border-r-2 border-black">Run Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-zinc-200">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-zinc-50 transition-none">
                  <td className="p-3 border-r-2 border-black font-black uppercase text-xs tracking-tight">
                    <button
                      onClick={() => setSelectedRunId(run.id)}
                      className="hover:text-[#2596BE] transition-none text-left"
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
                  <td className="p-3 border-r-2 border-black text-xs text-zinc-500 font-mono">
                    {run.createdAt
                      ? new Date(run.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(run.id)}
                      disabled={deletingId === run.id}
                      className="text-[10px] font-bold uppercase border border-black px-2 py-1 hover:bg-red-600 hover:text-white transition-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === run.id ? "Deleting…" : "Delete"}
                    </button>
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
