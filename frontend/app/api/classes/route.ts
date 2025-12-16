import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabaseServerClient";

type CourseRow = {
  id: string;
  title: string | null;
  department: string | null;
  course_number: string | null;
};

type ClassResponse = {
  id: string;
  name: string;
  code: string | null;
};

export async function GET() {
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

  const { data, error } = await supabase
    .from("courses")
    .select<CourseRow>("id, title, department, course_number")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const classes: ClassResponse[] =
    data?.map((course) => {
      const codeParts = [course.department, course.course_number].filter(Boolean).join(" ").trim();
      const fallbackName = codeParts || "Untitled course";
      return {
        id: course.id,
        name: course.title?.trim() || fallbackName,
        code: codeParts || null,
      };
    }) ?? [];

  return NextResponse.json({ classes }, { status: 200 });
}
