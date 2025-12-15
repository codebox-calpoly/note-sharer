import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const STORAGE_BUCKET = "resources";

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

const ensureResourcesBucket = async (adminClient: ReturnType<typeof createClient>) => {
  const { data: buckets, error: listError } = await adminClient.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  const exists = buckets?.some((bucket) => bucket.name === STORAGE_BUCKET);
  if (exists) return;

  const { error: createError } = await adminClient.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(PDF_MIME_TYPES),
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw createError;
  }
};

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bypassEnabled = process.env.NEXT_PUBLIC_UPLOAD_BYPASS === "true";
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

  const formData = await req.formData();
  const file = formData.get("file");
  const classId = (formData.get("class_id") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();

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

  const { data: resource, error: insertError } = await supabase
    .from("resources")
    .insert({
      profile_id: userId,
      course_id: classId,
      title,
      file_key: filePath,
      preview_key: filePath,
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
