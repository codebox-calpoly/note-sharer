import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

export async function GET(req: Request) {
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ allowed: false, error: mod.error }, { status: mod.status });
  }

  return NextResponse.json(
    {
      allowed: true,
      roles: mod.roles,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
