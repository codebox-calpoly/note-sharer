export type ProfileStats = {
  totalUploads: number;
  totalUpvotes: number;
  creditsEarned: number;
  creditsSpent: number;
  netCredits: number;
};

export type ProfileStatsResponse = {
  stats?: Partial<ProfileStats>;
  rank?: {
    allTime?: number | null;
    totalContributors?: number;
  };
};

export function toProfileStats(payload: ProfileStatsResponse | null | undefined): ProfileStats {
  return {
    totalUploads: Number(payload?.stats?.totalUploads ?? 0),
    totalUpvotes: Number(payload?.stats?.totalUpvotes ?? 0),
    creditsEarned: Number(payload?.stats?.creditsEarned ?? 0),
    creditsSpent: Number(payload?.stats?.creditsSpent ?? 0),
    netCredits: Number(payload?.stats?.netCredits ?? 0),
  };
}

export function getRankValue(payload: ProfileStatsResponse | null | undefined): number | null {
  const rawRank = payload?.rank?.allTime;
  if (typeof rawRank !== "number" || !Number.isFinite(rawRank)) return null;
  return rawRank;
}

export function displayStatValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "\u2014";
  return String(value);
}
