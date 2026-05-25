import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateBlurredFirstPageBuffer } from "./helpers/preview";
import { readBlockedAt } from "@/lib/moderation";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const STORAGE_ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg"]);
const STORAGE_BUCKET = "resources";
const RESOURCE_TYPES = new Set([
  "lecture_notes",
  "study_guide",
  "class_overview",
]);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const extractAccessToken = (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.split(" ")[1]?.trim() ?? null;
  }

  const cookieToken = req.cookies.get("sb-access-token")?.value;
  return cookieToken ?? null;
};

const buildFilePath = (userId: string, originalName: string) => {
  const baseName = originalName.split(".").slice(0, -1).join(".") || "upload";
  const safeBase = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = randomUUID();
  const normalizedBase = safeBase ? safeBase.slice(0, 60) : "upload";
  return `${userId}/${suffix}-${normalizedBase}.pdf`;
};

function buildPreviewPath(pdfFilePath: string): string {
  const parts = pdfFilePath.split("/");
  const fileName = parts.pop() ?? "";
  const userId = parts[0] ?? "unknown";
  const baseName = fileName.replace(/\.pdf$/i, "");
  const uuidMatch = baseName.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  const id = uuidMatch ? uuidMatch[1] : baseName || randomUUID();
  return `previews/${userId}/${id}.jpg`;
}

const ensureResourcesBucket = async (adminClient: SupabaseClient) => {
  const { data: buckets, error: listError } = await adminClient.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  const existing = buckets?.find((bucket) => bucket.name === STORAGE_BUCKET);
  const desiredMimeTypes = Array.from(STORAGE_ALLOWED_MIME_TYPES);

  if (!existing) {
    const { error: createError } = await adminClient.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
      allowedMimeTypes: desiredMimeTypes,
    });

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw createError;
    }
    return;
  }

  const existingMimeTypes = existing.allowed_mime_types ?? [];
  const hasAllMimeTypes = desiredMimeTypes.every((mime) => existingMimeTypes.includes(mime));
  if (hasAllMimeTypes) {
    return;
  }

  const { error: updateError } = await adminClient.storage.updateBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: desiredMimeTypes,
  });
  if (updateError) {
    throw updateError;
  }
};

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bypassEnabled =
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_UPLOAD_BYPASS === "true";
  const bypassProfileId = process.env.UPLOAD_BYPASS_PROFILE_ID;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const accessToken = extractAccessToken(req);
  const usingBypass = !accessToken && bypassEnabled && bypassProfileId;
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  let userId: string | null = null;
  if (accessToken) {
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }
    userId = authData.user.id;
  } else if (usingBypass) {
    userId = bypassProfileId!;
  } else {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  try {
    const blockedAt = await readBlockedAt(adminClient, userId);
    if (blockedAt) {
      return NextResponse.json(
        { error: "This account is blocked from uploading notes." },
        { status: 403 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to verify account status.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const classId = (formData.get("class_id") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const resourceType = (formData.get("resource_type") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const professor = (formData.get("professor") as string | null)?.trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  if (!classId || !isUuid(classId)) {
    return NextResponse.json({ error: "class_id must be a valid UUID." }, { status: 400 });
  }

  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "title is required and must be at most 200 characters." },
      { status: 400 },
    );
  }

  if (!resourceType || !RESOURCE_TYPES.has(resourceType)) {
    return NextResponse.json(
      { error: "resource_type must be a valid value." },
      { status: 400 },
    );
  }

  if (!description) {
    return NextResponse.json(
      { error: "description is required." },
      { status: 400 },
    );
  }

  if (description.length > 2000) {
    return NextResponse.json(
      { error: "description must be at most 2000 characters." },
      { status: 400 },
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `PDF must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.` },
      { status: 400 },
    );
  }

  const mime = file.type?.toLowerCase();
  const nameIsPdf = file.name?.toLowerCase().endsWith(".pdf");
  if (!PDF_MIME_TYPES.has(mime) && !nameIsPdf) {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  const filePath = buildFilePath(userId, file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    await ensureResourcesBucket(adminClient);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to prepare storage bucket.", details: message },
      { status: 500 },
    );
  }

  const { error: uploadError } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload file.", details: uploadError.message },
      { status: 500 },
    );
  }

  // Use a client scoped to the user's JWT so row-level security checks apply.
  const supabase = accessToken
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })
    : adminClient;
  
  let previewKey: string | null = null;
  const tmpPdf = path.join(os.tmpdir(), `upload-${randomUUID()}.pdf`);
  try {
    fs.writeFileSync(tmpPdf, fileBuffer);
    const blurredBuffer = await generateBlurredFirstPageBuffer(tmpPdf);
    const previewPath = buildPreviewPath(filePath);
    const { error: previewUploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(previewPath, blurredBuffer, {
        cacheControl: "3600",
        contentType: "image/jpeg",
        upsert: false,
      });
    if (previewUploadError) {
      console.error("Preview upload failed", previewUploadError);
    } else {
      previewKey = previewPath;
    }
  } catch (previewErr) {
    console.error("Preview generation failed", previewErr);
  } finally {
    if (fs.existsSync(tmpPdf)) {
      fs.unlinkSync(tmpPdf);
    }
  }

  // If blurred preview failed, fall back to file_key so we still have a preview_key (required by schema).
  // Notes API will return a signed URL for the PDF and the UI can show a blurred PDF preview.
  if (previewKey == null) {
    previewKey = filePath;
  }

  // Only admin/moderator/developer roles get notes auto-approved (for test notes); others stay pending for moderator review.
  let status: "pending" | "active" = "pending";
  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("profile_id", userId)
    .in("role", ["admin", "moderator", "developer"]);
  if (roles && roles.length > 0) status = "active";

  const { data: resource, error: insertError } = await supabase
    .from("resources")
    .insert({
      profile_id: userId,
      course_id: classId,
      title,
      resource_type: resourceType,
      description: description || null,
      file_key: filePath,
      preview_key: previewKey,
      ...(professor != null && { professor }),
      ...(status === "active" && { status: "active" }),
    })
    .select()
    .single();

  if (insertError || !resource) {
    return NextResponse.json(
      { error: "Failed to save resource metadata.", details: insertError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: resource }, { status: 200 });
}
