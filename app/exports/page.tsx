import { createClient } from "@/lib/supabase/server";
import ExportsList from "../components/ExportsList";

export default async function ExportsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("export_history")
    .select("id, name, row_count, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black pb-16">
      <header className="mb-6 border-b-4 border-white pb-4">
        <h1 className="text-3xl font-black tracking-tight uppercase text-white">
          Exports
        </h1>
        <p className="text-sm font-bold mt-1 text-zinc-500 uppercase tracking-wider">
          Every detailed export you&apos;ve generated, saved to your account
        </p>
      </header>

      <ExportsList initialExports={data || []} />
    </div>
  );
}
