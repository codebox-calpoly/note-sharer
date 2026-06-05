import { displayStatValue, getRankValue, toProfileStats } from "@/app/(poly)/profile/stats";

describe("profile dashboard stats helpers", () => {
  it("fills missing stats with zero", () => {
    expect(toProfileStats({})).toEqual({
      totalUploads: 0,
      totalUpvotes: 0,
      creditsEarned: 0,
      creditsSpent: 0,
      netCredits: 0,
    });
  });

  it("returns null rank when rank is missing", () => {
    expect(getRankValue({ rank: {} })).toBeNull();
    expect(getRankValue({ rank: { allTime: 3 } })).toBe(3);
  });

  it("displays em dash for invalid values", () => {
    expect(displayStatValue(undefined)).toBe("\u2014");
    expect(displayStatValue(null)).toBe("\u2014");
    expect(displayStatValue(12)).toBe("12");
  });
});
