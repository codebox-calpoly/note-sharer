"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { useRegisterNavRight } from "@/app/(poly)/PolyShell";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useTheme } from "@/app/components/ThemeProvider";
import { CourseEnrollmentPicker, type EnrollmentCourseOption } from "@/app/components/CourseEnrollmentPicker";
import { displayStatValue, getRankValue, toProfileStats, type ProfileStats } from "./stats";
import "./profile.css";
import "../course/course-detail.css";

type ProfileNote = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  class_id: string | null;
  profile_display_name: string | null;
  resource_type: string | null;
  upvote_count: number;
  downvote_count: number;
  score: number;
  download_cost: number;
  downloaded: boolean;
};

type EnrollmentResponse = {
  activeCycle: {
    id: string;
    name: string;
    catalogTerm: string | null;
  } | null;
  selectedClasses: EnrollmentCourseOption[];
  selectedCourseIds: string[];
  enrollmentRequired: boolean;
};

/** Derive avatar initials from display name (e.g. "Violet Peacock" → "VP", "VioletPeacock" → "Vi"). */
function getInitialsFromDisplayName(displayName: string): string {
  const s = displayName.trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0][0] ?? "";
    const last = parts[parts.length - 1][0] ?? "";
    return (first + last).toUpperCase().slice(0, 2);
  }
  return s.slice(0, 2).toUpperCase();
}

function getDisplayInitial(user: User | null): string {
  if (!user) return "?";
  const email = user.email;
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  // new stats
  const [totalUploads, setTotalUploads] = useState<number | null>(null);
  const [totalUpvotes, setTotalUpvotes] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"uploads" | "downloads" | "favorites">("uploads");
  const [uploads, setUploads] = useState<ProfileNote[]>([]);
  const [downloads, setDownloads] = useState<ProfileNote[]>([]);
  const [favorites, setFavorites] = useState<ProfileNote[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentResponse | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<EnrollmentCourseOption[]>([]);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      const { session, error } = await getSessionWithRecovery(supabase);
      if (error) setCreditsError("Not authenticated");
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setTokenLoaded(true);
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfileDisplayName(null);
      setProfileHandle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = data as { display_name: string | null; handle: string | null } | null;
      setProfileDisplayName(row?.display_name?.trim() ?? null);
      setProfileHandle(row?.handle?.trim() ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me/enrollment", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok || cancelled) return;
      const payload = (await res.json()) as EnrollmentResponse;
      if (cancelled) return;
      setEnrollment(payload);
      setSelectedCourses(payload.selectedClasses ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const refreshCredits = useCallback(async () => {
    const { session } = await getSessionWithRecovery(supabase);
    if (!session?.access_token) {
      setCredits(null);
      return;
    }
    try {
      const res = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setCreditsError("Failed to load credits");
        setCredits(null);
        setTotalUploads(null);
        setTotalUpvotes(null);
        return;
      }
      const data = await res.json();
      setCredits(Number.isFinite(data?.credits) ? Number(data.credits) : 0);
      setCreditsError(null);
      setTotalUploads(Number.isFinite(data?.uploadCount) ? Number(data.uploadCount) : 0);
      setTotalUpvotes(Number.isFinite(data?.upvoteCount) ? Number(data.upvoteCount) : 0);
    } catch {
      setCreditsError("Failed to load credits");
      setCredits(null);
      setTotalUploads(null);
      setTotalUpvotes(null);
    }
  }, []);

  useEffect(() => {
    if (!tokenLoaded) return;
    const t = setTimeout(() => void refreshCredits(), 0);
    return () => clearTimeout(t);
  }, [refreshCredits, tokenLoaded]);

  const fetchUploads = useCallback(async () => {
    if (!accessToken) return;
    setLoadingUploads(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/notes?mine=1&page_size=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setNotesError(payload.error ?? "Failed to load uploads");
        setUploads([]);
        return;
      }
      const data = (await res.json()) as { notes?: ProfileNote[] };
      setUploads(data.notes ?? []);
    } catch {
      setNotesError("Failed to load uploads");
      setUploads([]);
    } finally {
      setLoadingUploads(false);
    }
  }, [accessToken]);

  const fetchDownloads = useCallback(async () => {
    if (!accessToken) return;
    setLoadingDownloads(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/notes?downloaded=1&page_size=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setNotesError(payload.error ?? "Failed to load downloads");
        setDownloads([]);
        return;
      }
      const data = (await res.json()) as { notes?: ProfileNote[] };
      setDownloads(data.notes ?? []);
    } catch {
      setNotesError("Failed to load downloads");
      setDownloads([]);
    } finally {
      setLoadingDownloads(false);
    }
  }, [accessToken]);

  const fetchFavorites = useCallback(async () => {
    if (!accessToken) return;
    setLoadingFavorites(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/notes?favorited=1&page_size=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setNotesError(payload.error ?? "Failed to load bookmarks");
        setFavorites([]);
        return;
      }
      const data = (await res.json()) as { notes?: ProfileNote[] };
      setFavorites(data.notes ?? []);
      setFavoritesLoaded(true);
    } catch {
      setNotesError("Failed to load bookmarks");
      setFavorites([]);
    } finally {
      setLoadingFavorites(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!tokenLoaded || !accessToken) return;
    void fetchUploads();
  }, [tokenLoaded, accessToken, fetchUploads]);

  useEffect(() => {
    if (!tokenLoaded || !accessToken) return;
    void fetchDownloads();
  }, [tokenLoaded, accessToken, fetchDownloads]);

  useEffect(() => {
    if (!tokenLoaded || !accessToken || activeTab !== "favorites" || favoritesLoaded) return;
    void fetchFavorites();
  }, [tokenLoaded, accessToken, activeTab, favoritesLoaded, fetchFavorites]);

  const fetchProfileStats = useCallback(async () => {
    if (!accessToken) return;
    setLoadingStats(true);
    setStatsError(null);

    try {
      const res = await fetch("/api/profile/stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setStatsError(payload.error ?? "Failed to load stats");
        setProfileStats(null);
        setLeaderboardRank(null);
        return;
      }

      const payload = (await res.json()) as {
        stats?: ProfileStats;
        rank?: { allTime?: number | null; totalContributors?: number };
      };

      setProfileStats(toProfileStats(payload));
      setLeaderboardRank(getRankValue(payload));
    } catch {
      setStatsError("Failed to load stats");
      setProfileStats(null);
      setLeaderboardRank(null);
    } finally {
      setLoadingStats(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!tokenLoaded || !accessToken) return;
    void fetchProfileStats();
  }, [tokenLoaded, accessToken, fetchProfileStats]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/");
  }, [router]);

  const nickname =
    profileDisplayName ?? profileHandle ?? user?.email?.split("@")[0] ?? "User";
  const initial =
    profileDisplayName ?? profileHandle
      ? getInitialsFromDisplayName(profileDisplayName ?? profileHandle ?? "")
      : getDisplayInitial(user);
  const displayedStats = profileStats ?? null;
  const { theme } = useTheme();

  const profileNavRight = useMemo(
    () => (
      <>
        <span className="profile-page__credits-pill">Credits: {credits ?? "—"}</span>
        <Link href="/profile" className="profile-page__profile-btn" aria-label="Profile">
          {initial}
        </Link>
      </>
    ),
    [credits, initial],
  );
  useRegisterNavRight(profileNavRight);

  const saveEnrollment = useCallback(async () => {
    if (!accessToken) return;
    setSavingEnrollment(true);
    setEnrollmentError(null);
    try {
      const res = await fetch("/api/me/enrollment", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ courseIds: selectedCourses.map((course) => course.id) }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save enrolled courses.");
      }
      const payload = (await res.json()) as EnrollmentResponse;
      setEnrollment(payload);
      setSelectedCourses(payload.selectedClasses ?? []);
    } catch (saveError) {
      setEnrollmentError(
        saveError instanceof Error ? saveError.message : "Failed to save enrolled courses.",
      );
    } finally {
      setSavingEnrollment(false);
    }
  }, [accessToken, selectedCourses]);

  const formatType = (value: string | null) => {
    if (value === "lecture_notes") return "Lecture Notes";
    if (value === "study_guide") return "Study Guide";
    if (value === "class_overview") return "Class Overview";
    return "Note";
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const scoreClass = (score: number) =>
    score > 0
      ? "course-detail-note-score course-detail-note-score--positive"
      : score < 0
        ? "course-detail-note-score course-detail-note-score--negative"
        : "course-detail-note-score course-detail-note-score--neutral";

  return (
    <div className="profile-page">
      <div className="profile-page__body">
        <div className="profile-page__main">
          <div className="profile-page__content">
            <section
              className={`profile-page__card profile-page__profile-card page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
              style={{ transitionDelay: "0ms" }}
            >
              <div className="profile-page__profile-row">
                <div className="profile-page__profile-info">
                  <div className="profile-page__avatar" aria-hidden>{initial}</div>
                  <div className="profile-page__profile-meta">
                    <h1 className="profile-page__handle">{nickname}</h1>
                    {user?.email && (
                      <p className="profile-page__email">{user.email}</p>
                    )}
                    <p className="profile-page__bio">Share notes and earn credits.</p>
                  </div>
                </div>
                <div className="profile-page__rank-card">
                  <p className="profile-page__rank-label">Leaderboard Rank</p>
                  <p className="profile-page__rank-value">
                    {loadingStats ? "—" : displayStatValue(leaderboardRank)}
                  </p>
                  <p className="profile-page__rank-sub">All-time contributor rank</p>
                </div>
              </div>
            </section>

            <section
              className={`profile-page__card profile-page__tabs-card page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
              style={{ transitionDelay: "150ms" }}
            >
              <div className="profile-page__tabs">
                <button
                  type="button"
                  className={`profile-page__tab ${activeTab === "uploads" ? "active" : ""}`}
                  onClick={() => setActiveTab("uploads")}
                >
                  My Uploads
                </button>
                <button
                  type="button"
                  className={`profile-page__tab ${activeTab === "downloads" ? "active" : ""}`}
                  onClick={() => setActiveTab("downloads")}
                >
                  Downloads
                </button>
                <button
                  type="button"
                  className={`profile-page__tab ${activeTab === "favorites" ? "active" : ""}`}
                  onClick={() => setActiveTab("favorites")}
                >
                  Bookmarks
                </button>
              </div>
              <div
                className={`profile-page__note-list page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
                style={{ transitionDelay: "250ms" }}
              >
                {notesError && (
                  <p className="profile-page__error-inline" role="alert">{notesError}</p>
                )}
                {activeTab === "uploads" && (
                  <>
                    {loadingUploads && <p className="profile-page__loading">Loading your uploads…</p>}
                    {!loadingUploads && uploads.length === 0 && (
                      <p className="profile-page__empty">No uploads yet. Upload notes to get started.</p>
                    )}
                    {!loadingUploads && uploads.length > 0 && (
                      <ul className="profile-page__note-cards" aria-label="My uploads">
                        {uploads.map((note) => (
                          <li key={note.id}>
                            <Link
                              href={note.class_id ? `/course/${note.class_id}?open=${note.id}` : "/dashboard"}
                              className="course-detail-note-card profile-page__note-card"
                            >
                              <h3 className="course-detail-note-title">{note.title}</h3>
                              <div className="course-detail-note-secondary">
                                <span className="course-detail-note-type">{formatType(note.resource_type)}</span>
                                <span className="course-detail-note-date">{formatDate(note.created_at)}</span>
                              </div>
                              <div className="course-detail-note-meta">
                                <span className={scoreClass(note.score ?? 0)}>Score: {note.score ?? 0}</span>
                                <span className="course-detail-note-credits">
                                  Download: {note.download_cost} credits
                                </span>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {activeTab === "downloads" && (
                  <>
                    {loadingDownloads && <p className="profile-page__loading">Loading your downloads…</p>}
                    {!loadingDownloads && downloads.length === 0 && (
                      <p className="profile-page__empty">No downloads yet. Download notes from a course to see them here.</p>
                    )}
                    {!loadingDownloads && downloads.length > 0 && (
                      <ul className="profile-page__note-cards" aria-label="My downloads">
                        {downloads.map((note) => (
                          <li key={note.id}>
                            <Link
                              href={
                                note.class_id
                                  ? `/course/${note.class_id}?open=${note.id}`
                                  : "/dashboard"
                              }
                              className="course-detail-note-card profile-page__note-card"
                            >
                              <h3 className="course-detail-note-title">{note.title}</h3>
                              <div className="course-detail-note-secondary">
                                <span className="course-detail-note-type">{formatType(note.resource_type)}</span>
                                <span className="course-detail-note-date">{formatDate(note.created_at)}</span>
                              </div>
                              <div className="course-detail-note-meta">
                                <span className={scoreClass(note.score ?? 0)}>Score: {note.score ?? 0}</span>
                                <span className="course-detail-note-credits">🔓 Owned</span>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {activeTab === "favorites" && (
                  <>
                    {loadingFavorites && <p className="profile-page__loading">Loading your bookmarks…</p>}
                    {!loadingFavorites && favorites.length === 0 && (
                      <p className="profile-page__empty">No bookmarks yet. Save notes to keep them here.</p>
                    )}
                    {!loadingFavorites && favorites.length > 0 && (
                      <ul className="profile-page__note-cards" aria-label="My bookmarks">
                        {favorites.map((note) => (
                          <li key={note.id}>
                            <Link
                              href={
                                note.class_id
                                  ? `/course/${note.class_id}?open=${note.id}`
                                  : "/dashboard"
                              }
                              className="course-detail-note-card profile-page__note-card"
                            >
                              <h3 className="course-detail-note-title">{note.title}</h3>
                              <div className="course-detail-note-secondary">
                                <span className="course-detail-note-type">{formatType(note.resource_type)}</span>
                                <span className="course-detail-note-date">{formatDate(note.created_at)}</span>
                              </div>
                              <div className="course-detail-note-meta">
                                <span className={scoreClass(note.score ?? 0)}>Score: {note.score ?? 0}</span>
                                <span className="course-detail-note-credits">Bookmark</span>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          <aside
            className={`profile-page__sidebar page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="profile-page__stats-card">
              <h2 className="profile-page__stats-title">My Stats</h2>
              <div className="profile-page__stats-grid">
                <div className="profile-page__stat-row">
                  <span className="profile-page__stat-label">Total Uploads</span>
                  <span className="profile-page__stat-value">
                    {loadingStats ? "—" : displayStatValue(displayedStats?.totalUploads ?? totalUploads)}
                  </span>
                </div>
                <div className="profile-page__stat-row">
                  <span className="profile-page__stat-label">Total Upvotes</span>
                  <span className="profile-page__stat-value">
                    {loadingStats ? "—" : displayStatValue(displayedStats?.totalUpvotes ?? totalUpvotes)}
                  </span>
                </div>
                <div className="profile-page__stat-row">
                  <span className="profile-page__stat-label">Credits Earned</span>
                  <span className="profile-page__stat-value">
                    {loadingStats ? "—" : displayStatValue(displayedStats?.creditsEarned)}
                  </span>
                </div>
                <div className="profile-page__stat-row">
                  <span className="profile-page__stat-label">Credits Spent</span>
                  <span className="profile-page__stat-value">
                    {loadingStats ? "—" : displayStatValue(displayedStats?.creditsSpent)}
                  </span>
                </div>
              </div>
              <div className="profile-page__stat-divider" />
              <div className="profile-page__stat-row profile-page__stat-row--net">
                <span className="profile-page__stat-label">Net Credits</span>
                <span className="profile-page__stat-value profile-page__stat-value--net">
                  {loadingStats ? "—" : displayStatValue(displayedStats?.netCredits)}
                </span>
              </div>
              {statsError && (
                <p className="profile-page__error-inline" role="alert">{statsError}</p>
              )}
            </div>
            <div className="profile-page__stats-card">
              <h2 className="profile-page__stats-title">Current Classes</h2>
              <p className="profile-page__bio">
                {enrollment?.activeCycle?.name
                  ? `Update your enrolled courses for ${enrollment.activeCycle.name}.`
                  : "Update your current enrolled courses."}
              </p>
              <CourseEnrollmentPicker
                accessToken={accessToken}
                selectedCourses={selectedCourses}
                onChange={setSelectedCourses}
                disabled={savingEnrollment}
              />
              <div className="profile-page__actions-inline">
                <button
                  type="button"
                  className="profile-page__save-enrollment"
                  onClick={() => void saveEnrollment()}
                  disabled={savingEnrollment}
                >
                  {savingEnrollment ? "Saving..." : "Save courses"}
                </button>
              </div>
              {enrollmentError ? (
                <p className="profile-page__error-inline" role="alert">{enrollmentError}</p>
              ) : null}
            </div>
            <div className="profile-page__stats-card profile-page__appearance">
              <h2 className="profile-page__stats-title">Appearance</h2>
              <div className="profile-page__stat-row profile-page__stat-row--appearance">
                <span className="profile-page__stat-label">Theme</span>
                <ThemeToggle />
              </div>
              <p className="profile-page__appearance-hint">
                <span suppressHydrationWarning>
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </span>
              </p>
            </div>
          </aside>
        </div>
      </div>

      {creditsError && (
        <p className="profile-page__error" role="alert">{creditsError}</p>
      )}

      <div className="profile-page__actions">
        <button
          type="button"
          className="profile-page__logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </div>
  );
}
