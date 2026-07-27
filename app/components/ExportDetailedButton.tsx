"use client";

import { useState } from "react";

function defaultExportName() {
  return `SEC Leads Export - ${new Date().toISOString().slice(0, 10)}`;
}

export default function ExportDetailedButton({
  filterParams,
}: {
  filterParams: string;
}) {
  const [isNaming, setIsNaming] = useState(false);
  const [exportName, setExportName] = useState(defaultExportName());

  const startExport = () => {
    setExportName(defaultExportName());
    setIsNaming(true);
  };

  const confirmExport = () => {
    const name = exportName.trim() || defaultExportName();
    const params = filterParams
      ? `exportName=${encodeURIComponent(name)}&${filterParams}`
      : `exportName=${encodeURIComponent(name)}`;
    // Content-Disposition: attachment on the response means this triggers a
    // download rather than navigating away from the dashboard.
    window.location.href = `/api/export-search-detailed?${params}`;
    setIsNaming(false);
  };

  if (!isNaming) {
    return (
      <button
        type="button"
        onClick={startExport}
        title="Includes related persons, discovered investors, and filing history for every matching company"
        className="text-sm font-black bg-white text-black px-4 py-2 border-2 border-black uppercase tracking-wide hover:bg-[#2596BE] transition-none"
      >
        Export Detailed (XLSX)
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-white">
          Export Name
        </label>
        <input
          type="text"
          autoFocus
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmExport()}
          className="border-2 border-black p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#2596BE] bg-white w-56"
        />
      </div>
      <button
        type="button"
        onClick={confirmExport}
        className="bg-[#2596BE] border-2 border-black text-black font-bold uppercase px-4 py-2 hover:bg-emerald-400 transition-none"
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setIsNaming(false)}
        className="bg-white border-2 border-black text-black font-bold uppercase px-4 py-2 hover:bg-zinc-100 transition-none"
      >
        Cancel
      </button>
    </div>
  );
}
