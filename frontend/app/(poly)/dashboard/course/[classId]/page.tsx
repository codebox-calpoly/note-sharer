import { redirect } from "next/navigation";

type LegacyCoursePageProps = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyDashboardCoursePage({
  params,
  searchParams,
}: LegacyCoursePageProps) {
  const { classId } = await params;
  const currentSearchParams = await searchParams;
  const query = new URLSearchParams();

  Object.entries(currentSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }
    if (value != null) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  redirect(`/course/${encodeURIComponent(classId)}${queryString ? `?${queryString}` : ""}`);
}
