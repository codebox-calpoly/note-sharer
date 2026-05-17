import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/moderation";

type ProfilePreview = {
  id: string;
  handle: string | null;
  display_name: string | null;
  campus_email?: string | null;
};

type ReportResourcePreview = {
  id: string;
  title: string;
  status: string;
  profile_id: string | null;
  courses?: unknown;
};

type ReportDashboardRow = {
  reporter_id: string | null;
  resources?: ReportResourcePreview | null;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  const mod = await requireModerator(req);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.error }, { status: mod.status });
  }

  const adminClient = mod.adminClient;

  const [
    resourcesResult,
    reportsResult,
    blockedResult,
    promotionsResult,
    pendingCountResult,
    flaggedCountResult,
    reportsCountResult,
    blockedCountResult,
    activePromoCountResult,
  ] = await Promise.all([
    adminClient
      .from("resources")
      .select(
        `
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          resource_type,
          download_cost,
          profile_id,
          profiles ( id, handle, display_name, campus_email ),
          courses ( id, department, course_number, title )
        `,
      )
      .in("status", ["pending", "flagged"])
      .order("created_at", { ascending: true })
      .limit(30),
    adminClient
      .from("reports")
      .select(
        `
          id,
          resource_id,
          reporter_id,
          category,
          notes,
          weight,
          status,
          resolution_notes,
          created_at,
          resources (
            id,
            title,
            status,
            profile_id,
            courses ( id, department, course_number, title )
          )
        `,
      )
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(30),
    adminClient
      .from("profiles")
      .select("id, handle, display_name, campus_email, blocked_at, block_reason")
      .not("blocked_at", "is", null)
      .order("blocked_at", { ascending: false })
      .limit(20),
    adminClient
      .from("credit_promotions")
      .select("id, title, multiplier, starts_at, ends_at, ended_at, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    adminClient.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending"),
    adminClient.from("resources").select("id", { count: "exact", head: true }).eq("status", "flagged"),
    adminClient.from("reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).not("blocked_at", "is", null),
    adminClient
      .from("credit_promotions")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString()),
  ]);

  const firstError =
    resourcesResult.error ??
    reportsResult.error ??
    blockedResult.error ??
    promotionsResult.error ??
    pendingCountResult.error ??
    flaggedCountResult.error ??
    reportsCountResult.error ??
    blockedCountResult.error ??
    activePromoCountResult.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const rawReports = (reportsResult.data ?? []) as unknown as ReportDashboardRow[];

  const reporterIds = Array.from(
    new Set(
      rawReports
        .map((report: { reporter_id: string | null }) => report.reporter_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const ownerIds = Array.from(
    new Set(
      rawReports
        .map((report: { resources?: { profile_id?: string | null } | null }) => report.resources?.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const profileIds = Array.from(new Set([...reporterIds, ...ownerIds]));
  let profileMap = new Map<string, ProfilePreview>();

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, handle, display_name, campus_email")
      .in("id", profileIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    profileMap = new Map(
      (profiles ?? []).map((profile: ProfilePreview) => [profile.id, profile]),
    );
  }

  const reports = rawReports.map(
    (report: { reporter_id: string | null; resources?: { profile_id?: string | null } | null }) => ({
      ...report,
      reporter: report.reporter_id ? profileMap.get(report.reporter_id) ?? null : null,
      resourceOwner: report.resources?.profile_id
        ? profileMap.get(report.resources.profile_id) ?? null
        : null,
    }),
  );

  return NextResponse.json(
    {
      viewer: {
        id: mod.user.id,
        roles: mod.roles,
      },
      metrics: {
        pendingResources: pendingCountResult.count ?? 0,
        flaggedResources: flaggedCountResult.count ?? 0,
        openReports: reportsCountResult.count ?? 0,
        blockedUsers: blockedCountResult.count ?? 0,
        activePromotions: activePromoCountResult.count ?? 0,
      },
      resources: resourcesResult.data ?? [],
      reports,
      blockedUsers: blockedResult.data ?? [],
      promotions: promotionsResult.data ?? [],
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
