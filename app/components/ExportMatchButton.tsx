"use client";

import ExcelJS from "exceljs";
import { oneCompany } from "./PartnerModal";
import type { MatchResultEntry, MatchRunEntry } from "./MatchingEngine";

type Cell = string | number | boolean | null | undefined;
type ColumnDef = { header: string; key: string; width: number };

function safeFileBase(startupName: string): string {
  return (startupName || "match").replace(/[^a-z0-9]+/gi, "_");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: Cell): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2596BE" } };
}

function toCsvRow(columns: ColumnDef[], rowObj: Record<string, Cell>): Cell[] {
  return columns.map((c) => rowObj[c.key]);
}

// Every field we have on the contact/org, not just what the UI renders inline --
// this is the whole point of the export (per the ask: "even if the information
// is not showed, put it on the spreadsheet"). Score-related columns lead so
// sorting by score in a spreadsheet tool is trivial; rows themselves are already
// emitted in rank order.
const INVESTOR_COLUMNS: ColumnDef[] = [
  { header: "Rank", key: "rank", width: 8 },
  { header: "Match Score", key: "score", width: 12 },
  { header: "First Name", key: "firstName", width: 16 },
  { header: "Last Name", key: "lastName", width: 16 },
  { header: "Role", key: "role", width: 26 },
  { header: "Organization", key: "orgName", width: 24 },
  { header: "Org Website", key: "orgWebsite", width: 28 },
  { header: "Org AUM", key: "orgAum", width: 14 },
  { header: "Org Type", key: "orgType", width: 18 },
  { header: "Email", key: "email", width: 26 },
  { header: "LinkedIn", key: "linkedinUrl", width: 36 },
  { header: "Twitter", key: "twitter", width: 32 },
  { header: "Location", key: "location", width: 20 },
  { header: "Accreditation Verified", key: "accreditationVerified", width: 14 },
  { header: "Vertical Score", key: "vertical", width: 12 },
  { header: "Stage Score", key: "stage", width: 12 },
  { header: "Check Size Score", key: "checkSize", width: 14 },
  { header: "Text Score", key: "text", width: 10 },
  { header: "Similar Companies Count", key: "similarCount", width: 16 },
  { header: "Bio Similarity", key: "bioSimilarity", width: 14 },
  { header: "Bio", key: "bio", width: 60 },
];

function investorRowObject(r: MatchResultEntry): Record<string, Cell> {
  return {
    rank: r.rank,
    score: r.score,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role,
    orgName: r.orgName,
    orgWebsite: r.orgWebsite,
    orgAum: r.orgAum,
    orgType: r.orgType,
    email: r.email,
    linkedinUrl: r.linkedinUrl,
    twitter: r.twitter,
    location: r.location,
    accreditationVerified: r.accreditationVerified,
    vertical: r.scoreBreakdown.vertical,
    stage: r.scoreBreakdown.stage,
    checkSize: r.scoreBreakdown.check_size,
    text: r.scoreBreakdown.text,
    similarCount: r.scoreBreakdown.similar_companies?.length ?? 0,
    bioSimilarity: r.scoreBreakdown.bio_similarity ?? null,
    bio: r.bio,
  };
}

// Every company each investor has backed (current + enduring), with the
// company-level detail (website/description) that's normally only visible one
// click deep behind the company popup in the UI.
const PORTFOLIO_COLUMNS: ColumnDef[] = [
  { header: "Investor Rank", key: "rank", width: 10 },
  { header: "Investor Name", key: "investorName", width: 22 },
  { header: "Organization", key: "orgName", width: 24 },
  { header: "Company Name", key: "companyName", width: 24 },
  { header: "Relationship", key: "relationship", width: 16 },
  { header: "Company Website", key: "companyWebsite", width: 28 },
  { header: "Company Description", key: "companyDescription", width: 60 },
];

function portfolioRowObjects(results: MatchResultEntry[]): Record<string, Cell>[] {
  const rows: Record<string, Cell>[] = [];
  for (const r of results) {
    for (const inv of r.investments) {
      const co = oneCompany(inv.companies);
      if (!co) continue;
      rows.push({
        rank: r.rank,
        investorName: `${r.firstName} ${r.lastName}`,
        orgName: r.orgName,
        companyName: co.name,
        relationship: inv.relationship === "current" ? "Current" : "Enduring / Exited",
        companyWebsite: co.website ?? null,
        companyDescription: co.description,
      });
    }
  }
  return rows;
}

// The subset of each investor's portfolio that cleared the match's similarity
// threshold against the startup's description (see companySimilarity.ts).
const SIMILAR_COLUMNS: ColumnDef[] = [
  { header: "Investor Rank", key: "rank", width: 10 },
  { header: "Investor Name", key: "investorName", width: 22 },
  { header: "Organization", key: "orgName", width: 24 },
  { header: "Company Name", key: "companyName", width: 24 },
  { header: "Similarity Score", key: "similarityScore", width: 14 },
  { header: "Company Website", key: "companyWebsite", width: 28 },
  { header: "Company Description", key: "companyDescription", width: 60 },
];

function similarRowObjects(results: MatchResultEntry[]): Record<string, Cell>[] {
  const rows: Record<string, Cell>[] = [];
  for (const r of results) {
    for (const sc of r.scoreBreakdown.similar_companies ?? []) {
      rows.push({
        rank: r.rank,
        investorName: `${r.firstName} ${r.lastName}`,
        orgName: r.orgName,
        companyName: sc.companyName,
        similarityScore: sc.score,
        companyWebsite: sc.website,
        companyDescription: sc.description,
      });
    }
  }
  return rows;
}

function exportCsv(run: MatchRunEntry) {
  const results = [...run.results].sort((a, b) => a.rank - b.rank);
  const rows: Cell[][] = [
    [`Match: ${run.startupName}`],
    [],
    ["Investors"],
    INVESTOR_COLUMNS.map((c) => c.header),
    ...results.map((r) => toCsvRow(INVESTOR_COLUMNS, investorRowObject(r))),
    [],
    ["Portfolio Companies"],
    PORTFOLIO_COLUMNS.map((c) => c.header),
    ...portfolioRowObjects(results).map((row) => toCsvRow(PORTFOLIO_COLUMNS, row)),
    [],
    ["Similar Companies"],
    SIMILAR_COLUMNS.map((c) => c.header),
    ...similarRowObjects(results).map((row) => toCsvRow(SIMILAR_COLUMNS, row)),
  ];

  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  // Leading BOM so Excel detects UTF-8 instead of mangling special characters.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${safeFileBase(run.startupName)}-matches.csv`);
}

async function exportXlsx(run: MatchRunEntry) {
  const results = [...run.results].sort((a, b) => a.rank - b.rank);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ellerra Intelligence";

  const investorSheet = wb.addWorksheet("Investors");
  investorSheet.columns = INVESTOR_COLUMNS;
  styleHeaderRow(investorSheet.getRow(1));
  results.forEach((r) => investorSheet.addRow(investorRowObject(r)));

  const portfolioSheet = wb.addWorksheet("Portfolio Companies");
  portfolioSheet.columns = PORTFOLIO_COLUMNS;
  styleHeaderRow(portfolioSheet.getRow(1));
  portfolioRowObjects(results).forEach((row) => portfolioSheet.addRow(row));

  const similarSheet = wb.addWorksheet("Similar Companies");
  similarSheet.columns = SIMILAR_COLUMNS;
  styleHeaderRow(similarSheet.getRow(1));
  similarRowObjects(results).forEach((row) => similarSheet.addRow(row));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${safeFileBase(run.startupName)}-matches.xlsx`);
}

export default function ExportMatchButton({ run }: { run: MatchRunEntry }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => exportCsv(run)}
        className="px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => exportXlsx(run)}
        className="px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
      >
        Export XLSX
      </button>
    </div>
  );
}
