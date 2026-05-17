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

  if (id === mod.user.id) {
    return NextResponse.json({ error: "Moderators cannot block themselves." }, { status: 400 });
  }

  let payload: { blocked?: boolean; reason?: string } | null = null;
  try {
    payload = (await req.json()) as { blocked?: boolean; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const blocked = payload?.blocked !== false;
  const reason = payload?.reason?.trim() || null;
  const adminClient = mod.adminClient;

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update(
      blocked
        ? {
            blocked_at: new Date().toISOString(),
            blocked_by: mod.user.id,
            block_reason: reason,
          }
        : {
            blocked_at: null,
            blocked_by: null,
            block_reason: null,
          },
    )
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: auditError } = await adminClient.from("user_moderation_actions").insert({
    target_profile_id: id,
    moderator_id: mod.user.id,
    action: blocked ? "block" : "unblock",
    notes: reason,
  });

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  return NextResponse.json({ profile: { id, blocked } }, { status: 200 });
}
