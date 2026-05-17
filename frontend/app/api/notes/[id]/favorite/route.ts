import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabaseServerClient";
import { readBlockedAt } from "@/lib/moderation";

async function getAuthenticatedUser() {
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
    const status =
      userError?.message === "Auth session missing!" || !user
        ? 401
        : 500;
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: userError?.message ?? "Not authenticated" },
        { status },
      ),
    };
  }

  return { ok: true as const, user };
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: resourceId } = await params;
  if (!resourceId) {
    return NextResponse.json({ error: "Resource id is required." }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  try {
    const blockedAt = await readBlockedAt(adminClient, auth.user.id);
    if (blockedAt) {
      return NextResponse.json(
        { error: "This account is blocked from bookmarking notes." },
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

  // Keep exactly one favorite row per user/resource, even without a unique constraint.
  const { error: clearError } = await adminClient
    .from("resource_favorites")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("resource_id", resourceId);

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { error: insertError } = await adminClient
    .from("resource_favorites")
    .insert({
      profile_id: auth.user.id,
      resource_id: resourceId,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, favorited: true }, { status: 200 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: resourceId } = await params;
  if (!resourceId) {
    return NextResponse.json({ error: "Resource id is required." }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const { error } = await adminClient
    .from("resource_favorites")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("resource_id", resourceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, favorited: false }, { status: 200 });
}
