import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabaseServerClient";
import { readBlockedAt } from "@/lib/moderation";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: resourceId } = await params;
  if (!resourceId) {
    return NextResponse.json(
      { error: "Resource id is required." },
      { status: 400 },
    );
  }

  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.split(" ")[1]?.trim()
    : null;

  const supabase = await createClient(bearerToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const status = userError?.message === "Auth session missing!" ? 401 : 500;
    return NextResponse.json(
      { error: userError?.message ?? "Not authenticated" },
      { status },
    );
  }

  let body: { value?: number };
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const value = body.value;
  if (value !== 1 && value !== -1) {
    return NextResponse.json(
      { error: "Body must include value: 1 (upvote) or -1 (downvote)." },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
  try {
    const blockedAt = await readBlockedAt(adminClient, user.id);
    if (blockedAt) {
      return NextResponse.json(
        { error: "This account is blocked from voting on notes." },
        { status: 403 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to verify account status.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("votes").upsert(
    {
      resource_id: resourceId,
      profile_id: user.id,
      value,
    },
    {
      onConflict: "resource_id,profile_id",
    },
  );

  if (error && (error.code === "42501" || error.message?.includes("policy"))) {
    const { data: downloadRow } = await adminClient
      .from("resource_downloads")
      .select("id")
      .eq("resource_id", resourceId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (downloadRow?.id) {
      const { error: adminError } = await adminClient.from("votes").upsert(
        {
          resource_id: resourceId,
          profile_id: user.id,
          value,
        },
        { onConflict: "resource_id,profile_id" },
      );
      if (!adminError) {
        return NextResponse.json({ ok: true, value }, { status: 200 });
      }
    }
    return NextResponse.json(
      {
        error:
          "You can only vote on notes you have downloaded. Download this note first, then you can upvote or downvote it.",
      },
      { status: 403 },
    );
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, value }, { status: 200 });
}
