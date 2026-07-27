"use client";

import { useState } from "react";

interface ExportRow {
  id: string;
  name: string;
  row_count: number | null;
  created_at: string;
}

export default function ExportsList({
  initialExports,
}: {
  initialExports: ExportRow[];
}) {
  const [exports, setExports] = useState(initialExports);

  const deleteExport = async (id: string) => {
    const previous = exports;
    setExports((prev) => prev.filter((e) => e.id !== id));
    const res = await fetch(`/api/exports/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setExports(previous);
      alert("Failed to delete export");
    }
  };

  return (
    <div className="overflow-x-auto border-2 border-black bg-white">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-[#2596BE] border-b-2 border-black text-white font-black uppercase tracking-tight">
            <th className="p-3 border-r-2 border-black">Name</th>
            <th className="p-3 border-r-2 border-black">Created</th>
            <th className="p-3 border-r-2 border-black text-right">Rows</th>
            <th className="p-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-black font-bold">
          {exports.length > 0 ? (
            exports.map((exp) => (
              <tr
                key={exp.id}
                className="hover:bg-[#2596BE]/20 transition-none"
              >
                <td className="p-3 border-r-2 border-black font-bold text-zinc-900">
                  {exp.name}
                </td>
                <td className="p-3 border-r-2 border-black text-zinc-600">
                  {new Date(exp.created_at).toLocaleString()}
                </td>
                <td className="p-3 border-r-2 border-black text-right font-mono">
                  {exp.row_count ?? "N/A"}
                </td>
                <td className="p-3 text-center">
                  <div className="flex gap-2 justify-center text-xs">
                    <a
                      href={`/api/exports/${exp.id}/download`}
                      className="px-2 py-1 border-2 border-black bg-white hover:bg-black hover:text-white uppercase tracking-tight"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteExport(exp.id)}
                      className="px-2 py-1 border-2 border-black bg-white text-zinc-500 hover:bg-red-500 hover:text-white uppercase tracking-tight"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={4}
                className="p-8 text-center font-black uppercase text-xl text-zinc-400"
              >
                No exports yet — apply filters on the dashboard and export to
                get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
