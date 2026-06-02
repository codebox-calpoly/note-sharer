import { CALPOLY_PLACEHOLDER_COURSES, getCourseSubline } from "@/lib/catalog/calpoly-catalog";

describe("Cal Poly catalog helpers", () => {
  it("keeps units in official course sublines", () => {
    expect(getCourseSubline("AERO 1121")).toBe("Aerospace Fundamentals (2 units)");
  });

  it("uses official titles instead of scraped placeholder descriptions", () => {
    const course = CALPOLY_PLACEHOLDER_COURSES.find((candidate) => candidate.code === "ARCH 1131");
    expect(course?.name).toBe("ARCH 1131 - Architectural Representation I (2 units)");
  });
});
