import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: exportRow } = await supabase
    .from("export_history")
    .select("storage_path, name")
    .eq("id", id)
    .maybeSingle();

  if (!exportRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const downloadName = `${exportRow.name.replace(/[^\w.\- ]/g, "_")}.xlsx`;
  const { data: signed, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(exportRow.storage_path, 60, { download: downloadName });

  if (error || !signed) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 307);
}
