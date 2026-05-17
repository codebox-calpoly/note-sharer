import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabaseServerClient";
import { readBlockedAt } from "@/lib/moderation";

type ResourceDownloadRow = {
  id: string;
  file_key: string;
  profile_id: string;
  status: string;
  download_cost: number;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: resourceId } = await params;
  if (!resourceId) {
    return NextResponse.json({ error: "Resource id is required." }, { status: 400 });
  }

  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.split(" ")[1]?.trim()
    : null;

  const supabase = await createClient(bearerToken);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let user = session?.user ?? null;
  if (!user) {
    const {
      data: { user: fetchedUser },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      const status = userError.status === 401 ? 401 : 500;
      const message =
        userError.status === 401 || userError.message === "Auth session missing!"
          ? "Not authenticated"
          : userError.message;
      return NextResponse.json({ error: message }, { status });
    }
    user = fetchedUser ?? null;
  }

  if (sessionError && !user) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
        { error: "This account is blocked from downloading notes." },
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

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("id, file_key, profile_id, status, download_cost")
    .eq("id", resourceId)
    .single()
    .returns<ResourceDownloadRow>();

  if (resourceError || !resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  if (resource.status !== "active") {
    return NextResponse.json({ error: "Resource is not available for download." }, { status: 403 });
  }

  const isOwner = resource.profile_id === user.id;
  let alreadyOwned = isOwner;

  if (!alreadyOwned) {
    const { data: download, error: downloadError } = await supabase
      .from("resource_downloads")
      .select("id")
      .eq("resource_id", resourceId)
      .eq("profile_id", user.id)
      .maybeSingle()
      .returns<{ id: number }>();

    if (downloadError && downloadError.code !== "PGRST116") {
      return NextResponse.json({ error: downloadError.message }, { status: 500 });
    }

    alreadyOwned = Boolean(download?.id);
  }

  // Ensure owner has a resource_downloads row when they "download" so they can vote (Emma's policy).
  if (isOwner) {
    const { data: ownerDownload } = await supabase
      .from("resource_downloads")
      .select("id")
      .eq("resource_id", resourceId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!ownerDownload?.id) {
      await adminClient.from("resource_downloads").insert({
        resource_id: resourceId,
        profile_id: user.id,
        credits_spent: 0,
      });
    }
  }

  if (!alreadyOwned) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credit_score")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to read credits.", details: profileError?.message },
        { status: 500 },
      );
    }

    const cost = resource.download_cost ?? 0;
    const currentCredits = profile.credit_score ?? 0;

    if (currentCredits < cost) {
      return NextResponse.json(
        { error: `Insufficient credits: have ${currentCredits}, need ${cost}.` },
        { status: 402 },
      );
    }

    const newCredits = currentCredits - cost;
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ credit_score: newCredits })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update credits.", details: updateError.message },
        { status: 500 },
      );
    }

    const { error: downloadError } = await adminClient
      .from("resource_downloads")
      .insert({
        resource_id: resourceId,
        profile_id: user.id,
        credits_spent: cost,
      });

    if (downloadError) {
      return NextResponse.json(
        { error: "Failed to record download.", details: downloadError.message },
        { status: 500 },
      );
    }
  }

  const { data: fileData, error: fileError } = await adminClient.storage
    .from("resources")
    .download(resource.file_key);

  if (fileError || !fileData) {
    return NextResponse.json(
      { error: "Failed to download file.", details: fileError?.message },
      { status: 500 },
    );
  }

  const fileName = resource.file_key.split("/").pop() || "note.pdf";
  const fileBuffer = Buffer.from(await fileData.arrayBuffer());

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": fileData.type || "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
