import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabaseServerClient";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type ResourceRow = {
  id: string;
  title: string;
  course_id: string | null;
  created_at: string;
  file_key: string | null;
  preview_key: string | null;
  profiles: {
    display_name: string | null;
  } | null;
};

type VoteStatRow = {
  resource_id: string;
  upvotes: number | null;
  downvotes: number | null;
};

export async function GET(req: Request) {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.split(" ")[1]?.trim()
    : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
  const supabase = await createClient(bearerToken);
  const {
    data: { user },
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

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("class_id");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("page_size") ?? "16");
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("resources")
    .select<ResourceRow>(
      `
        id,
        title,
        course_id,
        created_at,
        file_key,
        preview_key,
        profiles ( display_name )
      `,
      { count: "exact" },
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: sort === "oldest" })
    .range(from, to);

  if (classId) {
    query = query.eq("course_id", classId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const hasMore = to + 1 < total;
  const ids = data?.map((row) => row.id) ?? [];

  let voteStats: VoteStatRow[] = [];
  if (ids.length > 0) {
    const { data: statsData } = await supabase
      .from("resource_vote_stats")
      .select<VoteStatRow>("resource_id, upvotes, downvotes")
      .in("resource_id", ids);
    voteStats = statsData ?? [];
  }

  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  voteStats.forEach((stat) => {
    voteMap.set(stat.resource_id, {
      upvotes: stat.upvotes ?? 0,
      downvotes: stat.downvotes ?? 0,
    });
  });

  const normalized = data
    ? await Promise.all(
        data.map(async (row) => {
          const stats = voteMap.get(row.id) ?? { upvotes: 0, downvotes: 0 };
          const base = {
            id: row.id,
            title: row.title,
            class_id: row.course_id,
            created_at: row.created_at,
            storage_path: row.file_key,
            profile_display_name: row.profiles?.display_name ?? null,
            upvote_count: stats.upvotes,
            downvote_count: stats.downvotes,
          };

          const path = row.preview_key ?? row.file_key;
          if (!path) {
            return { ...base, previewUrl: null };
          }

          const { data: signed, error: signedError } = await adminClient.storage
            .from("resources")
            .createSignedUrl(path, 3600);

          const previewUrl = signedError ? null : signed?.signedUrl ?? null;
          return { ...base, previewUrl };
        }),
      )
    : [];

  return NextResponse.json(
    {
      notes: normalized,
      page,
      pageSize,
      total,
      hasMore,
    },
    { status: 200 },
  );
}
