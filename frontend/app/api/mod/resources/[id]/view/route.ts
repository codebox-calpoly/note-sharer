import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

type ResourceFileRow = {
  id: string;
  file_key: string;
  title: string;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.error }, { status: mod.status });
  }

  const { data: resource, error: resourceError } = await mod.adminClient
    .from("resources")
    .select("id, file_key, title")
    .eq("id", id)
    .maybeSingle()
    .returns<ResourceFileRow>();

  if (resourceError) {
    return NextResponse.json({ error: resourceError.message }, { status: 500 });
  }

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const { data: fileData, error: fileError } = await mod.adminClient.storage
    .from("resources")
    .download(resource.file_key);

  if (fileError || !fileData) {
    return NextResponse.json(
      { error: "Failed to load PDF.", details: fileError?.message },
      { status: 500 },
    );
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer());
  const filename = `${resource.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "note"}.pdf`;

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": fileData.type || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
