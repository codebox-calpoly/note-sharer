import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.error }, { status: mod.status });
  }

  const { data: promotion, error } = await mod.adminClient
    .from("credit_promotions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, ended_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promotion }, { status: 200 });
}
