import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type EnrollmentCycleRow = {
  id: string;
  name: string;
  catalog_term: string | null;
  is_active: boolean;
};

type EnrollmentCourseJoinRow = {
  course_id: string;
  courses:
    | {
        id: string;
        title: string | null;
        department: string | null;
        course_number: string | null;
        term: string | null;
        year: number | null;
        description: string | null;
      }
    | {
        id: string;
        title: string | null;
        department: string | null;
        course_number: string | null;
        term: string | null;
        year: number | null;
        description: string | null;
      }[]
    | null;
};

export type EnrollmentClass = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  term: string | null;
  year: number | null;
  description: string | null;
};

export type EnrollmentState = {
  activeCycle: {
    id: string;
    name: string;
    catalogTerm: string | null;
  } | null;
  selectedClasses: EnrollmentClass[];
  selectedCourseIds: string[];
  enrollmentRequired: boolean;
};

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service role environment variables are not configured.");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
}

function isEnrollmentSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("enrollment_cycles") ||
    message.includes("profile_course_enrollments") ||
    message.includes("last_completed_enrollment_cycle_id")
  );
}

function toEnrollmentClass(row: EnrollmentCourseJoinRow): EnrollmentClass | null {
  const course = Array.isArray(row.courses) ? row.courses[0] ?? null : row.courses;
  if (!course) return null;
  const code = [course.department, course.course_number].filter(Boolean).join(" ").trim();
  return {
    id: course.id,
    name: course.title?.trim() || code || "Untitled course",
    code: code || null,
    department: course.department ?? null,
    term: course.term ?? null,
    year: course.year ?? null,
    description: course.description ?? null,
  };
}

export async function getActiveEnrollmentCycle(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from("enrollment_cycles")
    .select("id, name, catalog_term, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isEnrollmentSchemaMissing(error)) {
      return null;
    }
    throw error;
  }

  return (data as EnrollmentCycleRow | null) ?? null;
}

export async function getEnrollmentStateForUser(
  adminClient: SupabaseClient,
  userId: string,
): Promise<EnrollmentState> {
  const [activeCycle, profileResult] = await Promise.all([
    getActiveEnrollmentCycle(adminClient),
    adminClient
      .from("profiles")
      .select("last_completed_enrollment_cycle_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    if (isEnrollmentSchemaMissing(profileResult.error)) {
      return {
        activeCycle: null,
        selectedClasses: [],
        selectedCourseIds: [],
        enrollmentRequired: false,
      };
    }
    throw profileResult.error;
  }

  if (!activeCycle) {
    return {
      activeCycle: null,
      selectedClasses: [],
      selectedCourseIds: [],
      enrollmentRequired: false,
    };
  }

  const { data: enrollmentRows, error: enrollmentError } = await adminClient
    .from("profile_course_enrollments")
    .select(
      `
        course_id,
        courses (
          id,
          title,
          department,
          course_number,
          term,
          year
        )
      `,
    )
    .eq("profile_id", userId)
    .eq("cycle_id", activeCycle.id);

  if (enrollmentError) {
    if (isEnrollmentSchemaMissing(enrollmentError)) {
      return {
        activeCycle: {
          id: activeCycle.id,
          name: activeCycle.name,
          catalogTerm: activeCycle.catalog_term,
        },
        selectedClasses: [],
        selectedCourseIds: [],
        enrollmentRequired: false,
      };
    }
    throw enrollmentError;
  }

  const selectedClasses = ((enrollmentRows ?? []) as unknown as EnrollmentCourseJoinRow[])
    .map(toEnrollmentClass)
    .filter((value): value is EnrollmentClass => value != null)
    .sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name));

  const selectedCourseIds = selectedClasses.map((course) => course.id);
  const lastCompletedCycleId =
    profileResult.data &&
    typeof profileResult.data === "object" &&
    "last_completed_enrollment_cycle_id" in profileResult.data
      ? (profileResult.data.last_completed_enrollment_cycle_id as string | null)
      : null;

  return {
    activeCycle: {
      id: activeCycle.id,
      name: activeCycle.name,
      catalogTerm: activeCycle.catalog_term,
    },
    selectedClasses,
    selectedCourseIds,
    enrollmentRequired: lastCompletedCycleId !== activeCycle.id,
  };
}
