import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceRoleClient, getEnrollmentStateForUser } from "@/lib/enrollment";
import { CALPOLY_DEPARTMENTS, type DepartmentRecord } from "@/lib/calpoly-departments";
import { getMatchingDepartmentCodes } from "@/lib/department-search";
import {
  isCourseSearchMatch,
  normalizeCourseSearchQuery,
} from "@/lib/course-search";
import { createClient } from "@/utils/supabaseServerClient";
import { rankAndLimitCourseRows } from "./search-helpers";

type CourseRow = {
  id: string;
  title: string | null;
  department: string | null;
  course_number: number | null;
  term: string | null;
  year: number | null;
  description: string | null;
};

type ClassResponse = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  term: string | null;
  year: number | null;
  note_count: number;
  description: string | null;
};

const PAGE_SIZE = 1000;
const RESOURCE_PAGE_SIZE = 1000;
const RPC_BATCH_SIZE = 500;
const TITLE_SEARCH_CANDIDATE_LIMIT = 2000;

type RpcRow = { course_id: string; note_count: number };

type EnrolledClassesPayload = {
  enrolledClasses?: ClassResponse[];
};

async function getDepartmentsForSearch(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DepartmentRecord[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("code, name, aliases")
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error || !data || data.length === 0) {
    return [...CALPOLY_DEPARTMENTS];
  }

  return data.map((department) => ({
    code: department.code,
    name: department.name,
    aliases: Array.isArray(department.aliases) ? department.aliases : [],
  }));
}

/** Get note counts via DB RPC (accurate, no row limit). Falls back to paginated fetch if RPC fails. */
async function getNoteCountMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseIds: string[] | null
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();

  if (courseIds != null && courseIds.length === 0) return countMap;

  const ids = courseIds ?? [];
  const useRpc = ids.length > 0;

  if (useRpc) {
    let rpcFailed = false;
    for (let i = 0; i < ids.length && !rpcFailed; i += RPC_BATCH_SIZE) {
      const batch = ids.slice(i, i + RPC_BATCH_SIZE);
      const { data, error } = await supabase.rpc("get_course_note_counts", {
        p_course_ids: batch,
      });
      if (!error && Array.isArray(data)) {
        (data as RpcRow[]).forEach((row) => {
          countMap.set(row.course_id, Number(row.note_count) ?? 0);
        });
        continue;
      }
      if (error) rpcFailed = true;
    }
    if (!rpcFailed && (countMap.size > 0 || ids.length === 0)) return countMap;
  }

  return fetchNoteCountMapFallback(supabase, courseIds);
}

/** Fallback: fetch all active resource rows (paginated) and count when RPC is not available. */
async function fetchNoteCountMapFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseIds: string[] | null
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();
  let offset = 0;
  let hasMore = true;

  const maxInClause = 500;
  const useFilter = courseIds != null && courseIds.length > 0 && courseIds.length <= maxInClause;

  while (hasMore) {
    let query = supabase
      .from("resources")
      .select("course_id")
      .eq("status", "active")
      .range(offset, offset + RESOURCE_PAGE_SIZE - 1);
    if (useFilter) {
      query = query.in("course_id", courseIds!);
    }
    const { data: page, error } = await query;
    if (error) throw error;
    const list = (page ?? []) as { course_id: string }[];
    list.forEach((r) => {
      countMap.set(r.course_id, (countMap.get(r.course_id) ?? 0) + 1);
    });
    hasMore = list.length === RESOURCE_PAGE_SIZE;
    offset += RESOURCE_PAGE_SIZE;
  }

  return countMap;
}

function buildClasses(rows: CourseRow[], countMap: Map<string, number>): ClassResponse[] {
  return rows.map((course) => {
    const numStr =
      course.course_number != null ? String(course.course_number) : "";
    const codeParts = [course.department, numStr]
      .filter((s) => s !== "")
      .join(" ")
      .trim();
    const fallbackName = codeParts || "Untitled course";
    return {
      id: course.id,
      name: course.title?.trim() || fallbackName,
      code: codeParts || null,
      department: course.department ?? null,
      term: course.term ?? null,
      year: course.year ?? null,
      note_count: countMap.get(course.id) ?? 0,
      description: course.description ?? null,
    };
  });
}

async function getEnrolledClassesPayload(
  userId: string,
  predicate?: (value: ClassResponse) => boolean,
): Promise<EnrolledClassesPayload> {
  let enrollment;
  try {
    const adminClient = createServiceRoleClient();
    enrollment = await getEnrollmentStateForUser(adminClient, userId);
  } catch {
    return {};
  }
  if (enrollment.selectedClasses.length === 0) {
    return {};
  }

  const enrolledClasses = enrollment.selectedClasses
    .map((course) => ({
      ...course,
      note_count: 0,
    }))
    .filter((course) => (predicate ? predicate(course) : true));

  if (enrolledClasses.length === 0) {
    return {};
  }

  const enrolledIds = enrolledClasses.map((course) => course.id);
  let countMap = new Map<string, number>();
  try {
    const adminClient = createServiceRoleClient();
    countMap = await getNoteCountMap(adminClient, enrolledIds);
  } catch {
    countMap = new Map();
  }

  return {
    enrolledClasses: enrolledClasses
      .map((course) => ({
        ...course,
        note_count: countMap.get(course.id) ?? 0,
      }))
      .sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name)),
  };
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const classIdParam = searchParams.get("id")?.trim() || null;
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const departmentParamRaw = searchParams.get("department")?.trim() || null;
  const departmentParam = departmentParamRaw ? departmentParamRaw.toUpperCase() : null;
  const searchParamRaw = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || null;
  const searchParam = searchParamRaw
    ? normalizeCourseSearchQuery(searchParamRaw).slice(0, 80)
    : null;
  const includeEnrolled = searchParams.get("include_enrolled") === "1";
  // catalog_year: 2526 = 2025-2026 (default), 2627 = 2026-2027
  const catalogYearParam = searchParams.get("catalog_year");
  const catalogYear = catalogYearParam ? parseInt(catalogYearParam, 10) : 2526;
  const paginated = limitParam != null && limitParam !== "";
  const limit = paginated ? Math.min(Math.max(1, parseInt(limitParam, 10) || PAGE_SIZE), 1000) : PAGE_SIZE;
  const offset = paginated ? Math.max(0, parseInt(offsetParam ?? "0", 10)) : 0;
  const searchLimit = Math.min(500, limit);

  if (classIdParam) {
    const { data: course, error } = await supabase
      .from("courses")
      .select("id, title, department, course_number, term, year, description")
      .eq("id", classIdParam)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const classes = buildClasses([course as CourseRow], new Map<string, number>());
    const enrolledPayload =
      includeEnrolled && user
        ? await getEnrolledClassesPayload(user.id, (value) => value.id === course.id)
        : {};

    return NextResponse.json(
      { classes, hasMore: false, ...enrolledPayload },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  }

  if (searchParam && searchParam.length >= 1) {
    const hasSpace = searchParam.includes(" ");
    const deptPart = hasSpace ? searchParam.split(" ")[0] ?? "" : searchParam;
    const departments = await getDepartmentsForSearch(supabase);
    const aliasDepartmentCodes = getMatchingDepartmentCodes(departments, searchParam);
    const matchedDepartmentCodeSet = new Set(aliasDepartmentCodes);
    let codeQuery = supabase
      .from("courses")
      .select("id, title, department, course_number, term, year, description")
      .eq("catalog_year", catalogYear)
      .order("department", { ascending: true })
      .order("course_number", { ascending: true })
      .limit(hasSpace ? 2000 : searchLimit);
    if (hasSpace && deptPart.length > 0) {
      codeQuery = codeQuery.eq("department", deptPart);
    } else {
      codeQuery = codeQuery.ilike("department", `${deptPart}%`);
    }

    const [codeResult, aliasResult, titleResult] = await Promise.all([
      codeQuery,
      aliasDepartmentCodes.length > 0
        ? supabase
            .from("courses")
            .select("id, title, department, course_number, term, year, description")
            .eq("catalog_year", catalogYear)
            .order("department", { ascending: true })
            .order("course_number", { ascending: true })
            .in("department", aliasDepartmentCodes)
            .limit(2000)
        : Promise.resolve({ data: [] as CourseRow[], error: null }),
      supabase
        .from("courses")
        .select("id, title, department, course_number, term, year, description")
        .eq("catalog_year", catalogYear)
        .order("title", { ascending: true })
        .ilike("title", `%${searchParam}%`)
        .limit(TITLE_SEARCH_CANDIDATE_LIMIT),
    ]);

    if (codeResult.error) {
      return NextResponse.json({ error: codeResult.error.message }, { status: 500 });
    }
    if (aliasResult.error) {
      return NextResponse.json({ error: aliasResult.error.message }, { status: 500 });
    }
    if (titleResult.error) {
      return NextResponse.json({ error: titleResult.error.message }, { status: 500 });
    }

    const deduped = new Map<string, CourseRow>();
    ((codeResult.data ?? []) as CourseRow[]).forEach((row) => {
      deduped.set(row.id, row);
    });
    ((aliasResult.data ?? []) as CourseRow[]).forEach((row) => {
      deduped.set(row.id, row);
    });
    ((titleResult.data ?? []) as CourseRow[]).forEach((row) => {
      deduped.set(row.id, row);
    });

    const rows = rankAndLimitCourseRows(
      Array.from(deduped.values()),
      searchParam,
      searchLimit,
      matchedDepartmentCodeSet
    );

    const courseIds = rows.map((c) => c.id);
    let countMap: Map<string, number>;
    try {
      countMap = await getNoteCountMap(supabase, courseIds.length > 0 ? courseIds : null);
    } catch {
      countMap = new Map();
    }
    let classes = buildClasses(rows, countMap);
    let enrolledPayload: EnrolledClassesPayload = {};
    if (includeEnrolled && user) {
      enrolledPayload = await getEnrolledClassesPayload(user.id, (value) => {
        return isCourseSearchMatch(
          {
            code: value.code,
            name: value.name,
            department: value.department,
          },
          searchParam,
          { matchedDepartmentCodes: matchedDepartmentCodeSet }
        );
      });
      const enrolledIds = new Set((enrolledPayload.enrolledClasses ?? []).map((course) => course.id));
      classes = classes.filter((course) => !enrolledIds.has(course.id));
    }
    return NextResponse.json(
      { classes, hasMore: false, ...enrolledPayload },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  }

  if (paginated) {
    let query = supabase
      .from("courses")
      .select("id, title, department, course_number, term, year, description")
      .eq("catalog_year", catalogYear)
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);
    if (departmentParam) query = query.eq("department", departmentParam);
    const { data: page, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (page ?? []) as CourseRow[];
    const courseIds = rows.map((c) => c.id);
    let countMap: Map<string, number>;
    try {
      countMap = await getNoteCountMap(supabase, courseIds.length > 0 ? courseIds : null);
    } catch {
      countMap = new Map();
    }

    let classes = buildClasses(rows, countMap);
    let enrolledPayload: EnrolledClassesPayload = {};
    if (includeEnrolled && user && !departmentParam) {
      enrolledPayload = await getEnrolledClassesPayload(user.id);
      const enrolledIds = new Set((enrolledPayload.enrolledClasses ?? []).map((course) => course.id));
      classes = classes.filter((course) => !enrolledIds.has(course.id));
    }
    const hasMore = rows.length === limit;

    return NextResponse.json(
      { classes, hasMore, ...enrolledPayload },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  }

  const rows: CourseRow[] = [];
  let currentOffset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("courses")
      .select("id, title, department, course_number, term, year, description")
      .eq("catalog_year", catalogYear)
      .order("title", { ascending: true })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);
    if (departmentParam) query = query.eq("department", departmentParam);
    const { data: page, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const list = (page ?? []) as CourseRow[];
    rows.push(...list);
    hasMore = list.length === PAGE_SIZE;
    currentOffset += PAGE_SIZE;
  }

  const allCourseIds = rows.map((c) => c.id);
  let countMap: Map<string, number>;
  try {
    countMap = await getNoteCountMap(supabase, allCourseIds.length > 0 ? allCourseIds : null);
  } catch {
    countMap = new Map();
  }

  let classes = buildClasses(rows, countMap);
  let enrolledPayload: EnrolledClassesPayload = {};
  if (includeEnrolled && user && !departmentParam) {
    enrolledPayload = await getEnrolledClassesPayload(user.id);
    const enrolledIds = new Set((enrolledPayload.enrolledClasses ?? []).map((course) => course.id));
    classes = classes.filter((course) => !enrolledIds.has(course.id));
  }

  return NextResponse.json(
    { classes, ...enrolledPayload },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    }
  );
}
