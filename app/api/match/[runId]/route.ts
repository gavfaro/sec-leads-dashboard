import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Session client, not service-role -- the delete_own_match_runs RLS policy
  // (user_id = auth.uid()) is what actually enforces ownership here, same as
  // app/api/saved-searches/[id]/route.ts. match_results cascades automatically.
  const { data, error } = await supabase
    .from("match_runs")
    .delete()
    .eq("id", runId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json(
      { error: "Match run not found, or it doesn't belong to your account." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
