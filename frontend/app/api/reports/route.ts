import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabaseServerClient";
import { createServiceRoleClient, getBearerToken, readBlockedAt } from "@/lib/moderation";

const REPORT_CATEGORIES = new Set(["ip", "cheating", "abuse", "spam", "other"]);

export async function POST(req: Request) {
  const bearerToken = getBearerToken(req);
  const supabase = await createClient(bearerToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let payload: { resourceId?: string; category?: string; notes?: string } | null = null;
  try {
    payload = (await req.json()) as { resourceId?: string; category?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const resourceId = payload?.resourceId?.trim();
  const category = REPORT_CATEGORIES.has(payload?.category ?? "")
    ? payload?.category
    : "other";
  const notes = payload?.notes?.trim();

  if (!resourceId) {
    return NextResponse.json({ error: "resourceId is required." }, { status: 400 });
  }

  if (!notes) {
    return NextResponse.json({ error: "Report notes are required." }, { status: 400 });
  }

  const adminClient = createServiceRoleClient();

  try {
    const blockedAt = await readBlockedAt(adminClient, user.id);
    if (blockedAt) {
      return NextResponse.json(
        { error: "This account is blocked from submitting reports." },
        { status: 403 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify account status." },
      { status: 500 },
    );
  }

  const { data: resource, error: resourceError } = await adminClient
    .from("resources")
    .select("id, status")
    .eq("id", resourceId)
    .maybeSingle();

  if (resourceError) {
    return NextResponse.json({ error: resourceError.message }, { status: 500 });
  }

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("profile_id", user.id);

  const roleSet = new Set((roles ?? []).map((row: { role: string }) => row.role));
  const weight = roleSet.has("teacher") ? 4 : roleSet.has("ta") ? 3 : 1;

  const { data: report, error: insertError } = await adminClient
    .from("reports")
    .insert({
      resource_id: resourceId,
      reporter_id: user.id,
      category,
      notes,
      weight,
      status: "open",
    })
    .select("id, status")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ report }, { status: 201 });
}
