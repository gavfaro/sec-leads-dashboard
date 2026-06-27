"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";

export default function FilterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL if it exists
  const [nameSearch, setNameSearch] = useState(searchParams.get("name") || "");
  const [minRaise, setMinRaise] = useState(searchParams.get("minRaise") || "");
  const [stateCode, setStateCode] = useState(searchParams.get("state") || "");
  const [industry, setIndustry] = useState(searchParams.get("industry") || "");
  const [submissionType, setSubmissionType] = useState(
    searchParams.get("type") || "",
  );

  const applyFilters = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();

    if (nameSearch) params.set("name", nameSearch);
    if (minRaise) params.set("minRaise", minRaise);
    if (stateCode) params.set("state", stateCode.toUpperCase());
    if (industry) params.set("industry", industry);
    if (submissionType) params.set("type", submissionType);

    params.set("page", "1"); // Always reset to page 1 on new search

    router.push(`/?${params.toString()}`);
  };

  const clearFilters = () => {
    setNameSearch("");
    setMinRaise("");
    setStateCode("");
    setIndustry("");
    setSubmissionType("");
    router.push("/");
  };

  const saveSearch = () => {
    alert(
      `This would save { minRaise: '${minRaise}', state: '${stateCode}', industry: '${industry}', type: '${submissionType}' } to your saved_searches table!`,
    );
  };

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 p-4 border-2 border-black bg-white flex flex-wrap gap-4 items-end shadow-none"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          Company Name
        </label>
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="e.g. Acme Capital"
          className="border-2 border-black p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] w-48"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          Filing Type
        </label>
        <select
          value={submissionType}
          onChange={(e) => setSubmissionType(e.target.value)}
          className="border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] bg-white w-40"
        >
          <option value="">All Filings</option>
          <option value="D">New Notice (D)</option>
          <option value="D/A">Amendment (D/A)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          Min Target Raise ($)
        </label>
        <input
          type="number"
          value={minRaise}
          onChange={(e) => setMinRaise(e.target.value)}
          placeholder="e.g. 5000000"
          className="border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] w-36"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          State
        </label>
        <input
          type="text"
          maxLength={2}
          value={stateCode}
          onChange={(e) => setStateCode(e.target.value)}
          placeholder="e.g. CA"
          className="border-2 border-black p-2 font-mono text-sm uppercase w-20 focus:outline-none focus:ring-2 focus:ring-[#10B981]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          Industry Tag
        </label>
        <input
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g. Technology"
          className="border-2 border-black p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
        />
      </div>

      <div className="flex gap-2 ml-auto">
        <button
          type="submit"
          className="bg-[#10B981] border-2 border-black text-black font-bold uppercase px-6 py-2 hover:bg-emerald-400 transition-none"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="bg-white border-2 border-black text-black font-bold uppercase px-4 py-2 hover:bg-zinc-100 transition-none"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSearch}
          className="bg-black border-2 border-black text-white font-bold uppercase px-4 py-2 hover:bg-zinc-800 transition-none"
        >
          Save Search
        </button>
      </div>
    </form>
  );
}
