"use client";

import ExcelJS from "exceljs";

type Cell = string | number | boolean | null | undefined;

export interface ExportProfileData {
  companyName: string;
  accessionNumber: string;
  profileFields: [string, Cell][];
  offeringFields: [string, Cell][];
  relatedPersonsRows: Cell[][];
  discoveredInvestorsRows: Cell[][];
  filingHistoryRows: Cell[][];
}

function safeFileBase(companyName: string, accessionNumber: string) {
  return `${(companyName || "company").replace(/[^a-z0-9]+/gi, "_")}-${accessionNumber}`;
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

function exportCsv(data: ExportProfileData) {
  const rows: Cell[][] = [
    ["Company Profile"],
    ["Field", "Value"],
    ...data.profileFields,
    [],
    ["Offering & Capital Structure"],
    ["Field", "Value"],
    ...data.offeringFields,
    [],
    ["Related Persons"],
    ["Full Name", "Relationships", "City", "State/Country"],
    ...data.relatedPersonsRows,
    [],
    ["Discovered Investors"],
    ["Investor", "Type", "Role", "Confidence", "Method", "Evidence", "Source URL"],
    ...data.discoveredInvestorsRows,
    [],
    ["Filing History"],
    ["Filing Date", "Type", "Target Raise", "Amount Sold", "Accession Number"],
    ...data.filingHistoryRows,
  ];

  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  // Leading BOM so Excel detects UTF-8 instead of mangling special characters.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${safeFileBase(data.companyName, data.accessionNumber)}.csv`);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2596BE" },
  };
}

async function exportXlsx(data: ExportProfileData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ellerra Intelligence";

  const profileSheet = wb.addWorksheet("Company Profile");
  profileSheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 50 },
  ];
  styleHeaderRow(profileSheet.getRow(1));
  data.profileFields.forEach(([field, value]) =>
    profileSheet.addRow({ field, value: value ?? "" }),
  );

  const offeringSheet = wb.addWorksheet("Offering Terms");
  offeringSheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 30 },
  ];
  styleHeaderRow(offeringSheet.getRow(1));
  data.offeringFields.forEach(([field, value]) =>
    offeringSheet.addRow({ field, value: value ?? "" }),
  );

  const personsSheet = wb.addWorksheet("Related Persons");
  personsSheet.columns = [
    { header: "Full Name", key: "name", width: 26 },
    { header: "Relationships", key: "relationships", width: 30 },
    { header: "City", key: "city", width: 18 },
    { header: "State/Country", key: "state", width: 16 },
  ];
  styleHeaderRow(personsSheet.getRow(1));
  data.relatedPersonsRows.forEach((r) =>
    personsSheet.addRow({
      name: r[0] ?? "",
      relationships: r[1] ?? "",
      city: r[2] ?? "",
      state: r[3] ?? "",
    }),
  );

  const investorsSheet = wb.addWorksheet("Discovered Investors");
  investorsSheet.columns = [
    { header: "Investor", key: "investor", width: 26 },
    { header: "Type", key: "type", width: 16 },
    { header: "Role", key: "role", width: 16 },
    { header: "Confidence", key: "confidence", width: 14 },
    { header: "Method", key: "method", width: 16 },
    { header: "Evidence", key: "evidence", width: 40 },
    { header: "Source URL", key: "sourceUrl", width: 40 },
  ];
  styleHeaderRow(investorsSheet.getRow(1));
  data.discoveredInvestorsRows.forEach((r) =>
    investorsSheet.addRow({
      investor: r[0] ?? "",
      type: r[1] ?? "",
      role: r[2] ?? "",
      confidence: r[3] ?? "",
      method: r[4] ?? "",
      evidence: r[5] ?? "",
      sourceUrl: r[6] ?? "",
    }),
  );

  const historySheet = wb.addWorksheet("Filing History");
  historySheet.columns = [
    { header: "Filing Date", key: "date", width: 16 },
    { header: "Type", key: "type", width: 20 },
    { header: "Target Raise", key: "target", width: 16 },
    { header: "Amount Sold", key: "sold", width: 16 },
    { header: "Accession Number", key: "accession", width: 24 },
  ];
  styleHeaderRow(historySheet.getRow(1));
  data.filingHistoryRows.forEach((r) =>
    historySheet.addRow({
      date: r[0] ?? "",
      type: r[1] ?? "",
      target: r[2] ?? "",
      sold: r[3] ?? "",
      accession: r[4] ?? "",
    }),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${safeFileBase(data.companyName, data.accessionNumber)}.xlsx`);
}

export default function ExportProfileButtons({ data }: { data: ExportProfileData }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportCsv(data)}
        className="px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
      >
        Export CSV
      </button>
      <button
        onClick={() => exportXlsx(data)}
        className="px-4 py-2 border-2 border-black font-black uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
      >
        Export XLSX
      </button>
    </div>
  );
}
