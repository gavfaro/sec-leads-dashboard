import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
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
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!exportRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage
    .from("exports")
    .remove([exportRow.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error } = await supabase.from("export_history").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
