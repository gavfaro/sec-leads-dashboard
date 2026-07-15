"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, FormEvent } from "react";

const INDUSTRY_OPTIONS = [
  "Agriculture",
  "Airlines and Airports",
  "Biotechnology",
  "Business Services",
  "Coal Mining",
  "Commercial",
  "Commercial Banking",
  "Computers",
  "Construction",
  "Electric Utilities",
  "Energy Conservation",
  "Environmental Services",
  "Health Insurance",
  "Hospitals and Physicians",
  "Insurance",
  "Investing",
  "Investment Banking",
  "Lodging and Conventions",
  "Manufacturing",
  "Oil and Gas",
  "Other",
  "Other Banking and Financial Services",
  "Other Energy",
  "Other Health Care",
  "Other Real Estate",
  "Other Technology",
  "Other Travel",
  "Pharmaceuticals",
  "Pooled Investment Fund",
  "REITS and Finance",
  "Residential",
  "Restaurants",
  "Retailing",
  "Telecommunications",
  "Tourism and Travel Services",
  "Transportation",
];

const ENTITY_TYPE_OPTIONS = [
  "Corporation",
  "Limited Partnership",
  "Limited Liability Company",
  "Business Trust",
  "Other",
];

const FUND_TYPE_OPTIONS = [
  { value: "NONE", label: "Not a Fund (Operating Company)" },
  { value: "Hedge Fund", label: "Hedge Fund" },
  { value: "Private Equity Fund", label: "Private Equity Fund" },
  { value: "Venture Capital Fund", label: "Venture Capital Fund" },
  { value: "Other Investment Fund", label: "Other Investment Fund" },
];

const REVENUE_RANGE_OPTIONS = [
  "No Revenues",
  "$1 - $1,000,000",
  "$1,000,001 - $5,000,000",
  "$5,000,001 - $25,000,000",
  "$25,000,001 - $100,000,000",
  "Over $100,000,000",
  "Decline to Disclose",
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Filing Date (Newest)" },
  { value: "date_asc", label: "Filing Date (Oldest)" },
  { value: "raise_desc", label: "Target Raise (High to Low)" },
  { value: "sold_desc", label: "Amount Sold (High to Low)" },
  { value: "name_asc", label: "Company Name (A-Z)" },
];

const FIELD_KEYS = [
  "name",
  "cik",
  "city",
  "state",
  "industry",
  "entityType",
  "fundType",
  "type",
  "minRaise",
  "maxRaise",
  "offeringType",
  "minSold",
  "maxSold",
  "minCheck",
  "maxCheck",
  "revenueRange",
  "exemption",
  "accredited",
  "phoneOnly",
  "dateFrom",
  "dateTo",
  "sort",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];
type FieldState = Record<FieldKey, string>;

interface SavedSearch {
  id: string;
  search_name: string;
  filters: Partial<Record<FieldKey, string>>;
  created_at: string;
}

function initFromParams(searchParams: URLSearchParams): FieldState {
  const state = {} as FieldState;
  for (const key of FIELD_KEYS) {
    state[key] = searchParams.get(key) || "";
  }
  return state;
}

function emptyFields(): FieldState {
  const state = {} as FieldState;
  for (const key of FIELD_KEYS) state[key] = "";
  return state;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold uppercase tracking-wide text-zinc-600">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] bg-white";
const selectClass = `${inputClass} font-sans`;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full text-xs font-black uppercase tracking-widest text-white bg-black px-2 py-1 -mb-1">
      {children}
    </div>
  );
}

export default function FilterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fields, setFields] = useState<FieldState>(() =>
    initFromParams(searchParams),
  );

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [isNaming, setIsNaming] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/saved-searches")
      .then((res) => res.json())
      .then((data) => setSavedSearches(data.searches || []))
      .catch(() => setSavedSearches([]))
      .finally(() => setLoadingSaved(false));
  }, []);

  const set = (key: FieldKey) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const navigateWithFields = (fieldsToApply: FieldState) => {
    const params = new URLSearchParams();
    for (const key of FIELD_KEYS) {
      if (fieldsToApply[key]) params.set(key, fieldsToApply[key]);
    }
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  };

  const applyFilters = (e: FormEvent) => {
    e.preventDefault();
    navigateWithFields(fields);
  };

  const clearFilters = () => {
    setFields(emptyFields());
    router.push("/");
  };

  const startSaveSearch = () => {
    setNewSearchName("");
    setIsNaming(true);
  };

  const confirmSaveSearch = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSearchName.trim();
    if (!name || isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save search");
      setSavedSearches((prev) => [data.search, ...prev]);
      setIsNaming(false);
      setNewSearchName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save search");
    } finally {
      setIsSaving(false);
    }
  };

  const loadSearch = (search: SavedSearch) => {
    const loaded = emptyFields();
    for (const key of FIELD_KEYS) {
      loaded[key] = search.filters[key] || "";
    }
    setFields(loaded);
    navigateWithFields(loaded);
  };

  const deleteSearch = async (id: string) => {
    const previous = savedSearches;
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSavedSearches(previous);
      alert("Failed to delete saved search");
    }
  };

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 border-2 border-black bg-white shadow-none"
    >
      {/* Company */}
      <div className="p-4 flex flex-wrap gap-4 items-end border-b-2 border-black">
        <SectionLabel>Company</SectionLabel>
        <Field label="Company Name">
          <input
            type="text"
            value={fields.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="e.g. Acme Capital"
            className={`${inputClass} font-sans w-48`}
          />
        </Field>
        <Field label="CIK">
          <input
            type="text"
            inputMode="numeric"
            value={fields.cik}
            onChange={(e) => set("cik")(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 1234567"
            className={`${inputClass} w-32`}
          />
        </Field>
        <Field label="City">
          <input
            type="text"
            value={fields.city}
            onChange={(e) => set("city")(e.target.value)}
            placeholder="e.g. Austin"
            className={`${inputClass} font-sans w-36`}
          />
        </Field>
        <Field label="State / Country Code">
          <input
            type="text"
            maxLength={2}
            value={fields.state}
            onChange={(e) => set("state")(e.target.value)}
            placeholder="e.g. CA"
            className={`${inputClass} uppercase w-24`}
          />
        </Field>
        <Field label="Industry">
          <select
            value={fields.industry}
            onChange={(e) => set("industry")(e.target.value)}
            className={`${selectClass} w-48`}
          >
            <option value="">All Industries</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entity Type">
          <select
            value={fields.entityType}
            onChange={(e) => set("entityType")(e.target.value)}
            className={`${selectClass} w-44`}
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fund Type">
          <select
            value={fields.fundType}
            onChange={(e) => set("fundType")(e.target.value)}
            className={`${selectClass} w-52`}
          >
            <option value="">Any (Funds + Operating Cos.)</option>
            {FUND_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Filing */}
      <div className="p-4 flex flex-wrap gap-4 items-end border-b-2 border-black">
        <SectionLabel>Filing</SectionLabel>
        <Field label="Filing Type">
          <select
            value={fields.type}
            onChange={(e) => set("type")(e.target.value)}
            className={`${selectClass} w-40`}
          >
            <option value="">All Filings</option>
            <option value="D">New Notice (D)</option>
            <option value="D/A">Amendment (D/A)</option>
          </select>
        </Field>
        <Field label="Filing Date From">
          <input
            type="date"
            value={fields.dateFrom}
            onChange={(e) => set("dateFrom")(e.target.value)}
            className={`${inputClass} w-40`}
          />
        </Field>
        <Field label="Filing Date To">
          <input
            type="date"
            value={fields.dateTo}
            onChange={(e) => set("dateTo")(e.target.value)}
            className={`${inputClass} w-40`}
          />
        </Field>
        <Field label="Exemption Claimed">
          <select
            value={fields.exemption}
            onChange={(e) => set("exemption")(e.target.value)}
            className={`${selectClass} w-56`}
          >
            <option value="">Any Exemption</option>
            <option value="06b">Rule 506(b) — No General Solicitation</option>
            <option value="06c">Rule 506(c) — General Solicitation OK</option>
          </select>
        </Field>
        <Field label="Has Phone on File">
          <select
            value={fields.phoneOnly}
            onChange={(e) => set("phoneOnly")(e.target.value)}
            className={`${selectClass} w-40`}
          >
            <option value="">Any</option>
            <option value="true">Yes Only</option>
          </select>
        </Field>
        <Field label="Sort By">
          <select
            value={fields.sort}
            onChange={(e) => set("sort")(e.target.value)}
            className={`${selectClass} w-52`}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Financials */}
      <div className="p-4 flex flex-wrap gap-4 items-end border-b-2 border-black">
        <SectionLabel>Financials</SectionLabel>
        <Field label="Min Target Raise ($)">
          <input
            type="number"
            value={fields.minRaise}
            onChange={(e) => set("minRaise")(e.target.value)}
            placeholder="e.g. 5000000"
            className={`${inputClass} w-36`}
          />
        </Field>
        <Field label="Max Target Raise ($)">
          <input
            type="number"
            value={fields.maxRaise}
            onChange={(e) => set("maxRaise")(e.target.value)}
            placeholder="e.g. 50000000"
            className={`${inputClass} w-36`}
          />
        </Field>
        <Field label="Offering Amount">
          <select
            value={fields.offeringType}
            onChange={(e) => set("offeringType")(e.target.value)}
            className={`${selectClass} w-44`}
          >
            <option value="">Fixed or Indefinite</option>
            <option value="fixed">Fixed Amount Only</option>
            <option value="indefinite">Indefinite Only</option>
          </select>
        </Field>
        <Field label="Min Amount Sold ($)">
          <input
            type="number"
            value={fields.minSold}
            onChange={(e) => set("minSold")(e.target.value)}
            placeholder="e.g. 1000000"
            className={`${inputClass} w-36`}
          />
        </Field>
        <Field label="Max Amount Sold ($)">
          <input
            type="number"
            value={fields.maxSold}
            onChange={(e) => set("maxSold")(e.target.value)}
            placeholder="e.g. 100000000"
            className={`${inputClass} w-36`}
          />
        </Field>
        <Field label="Min Check Size ($)">
          <input
            type="number"
            value={fields.minCheck}
            onChange={(e) => set("minCheck")(e.target.value)}
            placeholder="e.g. 25000"
            className={`${inputClass} w-32`}
          />
        </Field>
        <Field label="Max Check Size ($)">
          <input
            type="number"
            value={fields.maxCheck}
            onChange={(e) => set("maxCheck")(e.target.value)}
            placeholder="e.g. 250000"
            className={`${inputClass} w-32`}
          />
        </Field>
      </div>

      {/* Investor Profile */}
      <div className="p-4 flex flex-wrap gap-4 items-end">
        <SectionLabel>Investor Profile</SectionLabel>
        <Field label="Revenue Range">
          <select
            value={fields.revenueRange}
            onChange={(e) => set("revenueRange")(e.target.value)}
            className={`${selectClass} w-52`}
          >
            <option value="">Any Revenue Range</option>
            {REVENUE_RANGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Non-Accredited Investors">
          <select
            value={fields.accredited}
            onChange={(e) => set("accredited")(e.target.value)}
            className={`${selectClass} w-48`}
          >
            <option value="">Any</option>
            <option value="true">Includes Non-Accredited</option>
            <option value="false">Accredited Only</option>
          </select>
        </Field>

        {isNaming ? (
          <div className="flex gap-2 ml-auto items-end">
            <Field label="Search Name">
              <input
                type="text"
                autoFocus
                value={newSearchName}
                onChange={(e) => setNewSearchName(e.target.value)}
                placeholder="e.g. CA Biotech, 506(c) Only"
                className={`${inputClass} font-sans w-56`}
              />
            </Field>
            <button
              type="button"
              onClick={confirmSaveSearch}
              disabled={!newSearchName.trim() || isSaving}
              className="bg-[#10B981] border-2 border-black text-black font-bold uppercase px-4 py-2 hover:bg-emerald-400 transition-none disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setIsNaming(false)}
              className="bg-white border-2 border-black text-black font-bold uppercase px-4 py-2 hover:bg-zinc-100 transition-none"
            >
              Cancel
            </button>
          </div>
        ) : (
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
              onClick={startSaveSearch}
              className="bg-black border-2 border-black text-white font-bold uppercase px-4 py-2 hover:bg-zinc-800 transition-none"
            >
              Save Search
            </button>
          </div>
        )}
      </div>

      {/* Saved Searches */}
      <div className="p-3 flex flex-wrap gap-2 items-center border-t-2 border-black bg-zinc-50">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-500 mr-1">
          Saved:
        </span>
        {loadingSaved && (
          <span className="text-xs font-mono text-zinc-400">Loading...</span>
        )}
        {!loadingSaved && savedSearches.length === 0 && (
          <span className="text-xs font-mono text-zinc-400">
            None yet — apply filters, then hit &quot;Save Search&quot;.
          </span>
        )}
        {savedSearches.map((search) => (
          <div
            key={search.id}
            className="flex items-center border-2 border-black bg-white text-xs font-bold uppercase"
          >
            <button
              type="button"
              onClick={() => loadSearch(search)}
              className="px-2 py-1 hover:bg-[#10B981]/30 transition-none"
              title="Load this saved search"
            >
              {search.search_name}
            </button>
            <button
              type="button"
              onClick={() => deleteSearch(search.id)}
              className="px-2 py-1 border-l-2 border-black text-zinc-400 hover:bg-red-500 hover:text-white transition-none"
              aria-label={`Delete ${search.search_name}`}
              title="Delete saved search"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </form>
  );
}
