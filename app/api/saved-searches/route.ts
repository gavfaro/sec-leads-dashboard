import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, search_name, filters, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ searches: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const filters =
    body?.filters && typeof body.filters === "object" ? body.filters : {};

  if (!name) {
    return NextResponse.json(
      { error: "Search name is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ search_name: name, filters })
    .select("id, search_name, filters, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ search: data }, { status: 201 });
}
