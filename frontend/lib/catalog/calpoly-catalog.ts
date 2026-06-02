import departmentCodes from "@/data/catalog/department-codes.json";
import placeholderCourses from "@/data/catalog/placeholder-courses.json";
import courseTitles from "@/data/catalog/course-titles.json";

export type CalPolyPlaceholderCourse = {
  department: string;
  code: string;
  name: string;
};

export const CALPOLY_DEPARTMENT_CODES = departmentCodes as readonly string[];

export type CalPolyDeptCode = (typeof CALPOLY_DEPARTMENT_CODES)[number];

export const CALPOLY_PLACEHOLDER_COURSES =
  placeholderCourses as readonly CalPolyPlaceholderCourse[];

export const CALPOLY_COURSE_TITLES = courseTitles as Record<string, string>;

export type CourseNameSource = {
  code?: string | null;
  name?: string | null;
};

export function getCourseSubline(course: CourseNameSource | string | null | undefined) {
  const code = typeof course === "string" ? course.trim() : course?.code?.trim();
  if (!code) return null;
  const raw = CALPOLY_COURSE_TITLES[code] ?? "";
  const title = raw.replace(/\s*\([^)]*units?\)\s*$/i, "").trim();
  if (!title || title.toLowerCase() === "test course") {
    return typeof course === "string" ? null : course?.name ?? null;
  }
  return title;
}
