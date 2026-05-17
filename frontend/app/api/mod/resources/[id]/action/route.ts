import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "active",
  reject: "removed",
  flag: "flagged",
  remove: "removed",
  archive: "archived",
  restore: "active",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.error }, { status: mod.status });
  }

  let payload: { action?: string; notes?: string; reportStatus?: string } | null = null;
  try {
    payload = (await req.json()) as { action?: string; notes?: string; reportStatus?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = payload?.action?.trim() ?? "";
  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) {
    return NextResponse.json({ error: "Unsupported moderation action." }, { status: 400 });
  }

  const notes = payload?.notes?.trim() || null;
  const adminClient = mod.adminClient;

  const { data: resource, error: resourceError } = await adminClient
    .from("resources")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (resourceError) {
    return NextResponse.json({ error: resourceError.message }, { status: 500 });
  }

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const { error: updateError } = await adminClient
    .from("resources")
    .update({ status: nextStatus })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: actionError } = await adminClient.from("moderation_actions").insert({
    resource_id: id,
    moderator_id: mod.user.id,
    action,
    notes,
  });

  if (actionError) {
    return NextResponse.json({ error: actionError.message }, { status: 500 });
  }

  if (payload?.reportStatus === "resolved" || payload?.reportStatus === "rejected") {
    const { error: reportsError } = await adminClient
      .from("reports")
      .update({
        status: payload.reportStatus,
        moderator_id: mod.user.id,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq("resource_id", id)
      .in("status", ["open", "reviewing"]);

    if (reportsError) {
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      resource: {
        id,
        previousStatus: resource.status,
        status: nextStatus,
      },
    },
    { status: 200 },
  );
}
