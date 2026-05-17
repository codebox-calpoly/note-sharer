import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

export async function POST(req: Request) {
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.error }, { status: mod.status });
  }

  let payload: {
    title?: string;
    durationMinutes?: number;
    startsAt?: string;
    reason?: string;
  } | null = null;
  try {
    payload = (await req.json()) as {
      title?: string;
      durationMinutes?: number;
      startsAt?: string;
      reason?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = payload?.title?.trim() || "Flash promotion";
  const durationMinutes = Number(payload?.durationMinutes ?? 60);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 60 || durationMinutes > 30 * 24 * 60) {
    return NextResponse.json(
      { error: "durationMinutes must be between 60 and 43200." },
      { status: 400 },
    );
  }

  const startsAt = payload?.startsAt ? new Date(payload.startsAt) : new Date();
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt must be a valid date." }, { status: 400 });
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const { data: promotion, error } = await mod.adminClient
    .from("credit_promotions")
    .insert({
      title,
      multiplier: 2,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: payload?.reason?.trim() || null,
      created_by: mod.user.id,
    })
    .select("id, title, multiplier, starts_at, ends_at, ended_at, reason")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promotion }, { status: 201 });
}
