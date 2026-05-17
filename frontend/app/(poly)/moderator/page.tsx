"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "./moderator.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type ProfilePreview = {
  id: string;
  handle: string | null;
  display_name: string | null;
  campus_email?: string | null;
  blocked_at?: string | null;
  block_reason?: string | null;
};

type CoursePreview = {
  id: string;
  department: string | null;
  course_number: string | null;
  title: string | null;
};

type ResourceReview = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  resource_type: string | null;
  download_cost: number;
  profile_id: string;
  profiles: ProfilePreview | null;
  courses: CoursePreview | null;
};

type ReportReview = {
  id: number;
  resource_id: string;
  reporter_id: string;
  category: string;
  notes: string | null;
  weight: number;
  status: string;
  created_at: string;
  reporter: ProfilePreview | null;
  resourceOwner: ProfilePreview | null;
  resources: {
    id: string;
    title: string;
    status: string;
    profile_id: string;
    courses: CoursePreview | null;
  } | null;
};

type Promotion = {
  id: string;
  title: string;
  multiplier: number;
  starts_at: string;
  ends_at: string;
  ended_at: string | null;
  reason: string | null;
  created_at?: string;
};

type ModeratorPayload = {
  viewer: {
    id: string;
    roles: string[];
  };
  metrics: {
    pendingResources: number;
    flaggedResources: number;
    openReports: number;
    blockedUsers: number;
    activePromotions: number;
  };
  resources: ResourceReview[];
  reports: ReportReview[];
  blockedUsers: ProfilePreview[];
  promotions: Promotion[];
};

type RequestState = {
  loading: boolean;
  error: string | null;
  message: string | null;
};

const emptyRequestState: RequestState = {
  loading: false,
  error: null,
  message: null,
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCourse(course: CoursePreview | null | undefined) {
  if (!course) return "Unknown course";
  const code = [course.department, course.course_number].filter(Boolean).join(" ");
  return code || course.title || "Unknown course";
}

function formatProfile(profile: ProfilePreview | null | undefined) {
  if (!profile) return "Unknown user";
  return profile.display_name || profile.handle || profile.campus_email || profile.id.slice(0, 8);
}

function isPromotionActive(promotion: Promotion) {
  const now = Date.now();
  return (
    promotion.ended_at == null &&
    new Date(promotion.starts_at).getTime() <= now &&
    new Date(promotion.ends_at).getTime() > now
  );
}

export default function ModeratorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [data, setData] = useState<ModeratorPayload | null>(null);
  const [loadState, setLoadState] = useState<RequestState>(emptyRequestState);
  const [actionState, setActionState] = useState<RequestState>(emptyRequestState);
  const [selectedResourceNotes, setSelectedResourceNotes] = useState<Record<string, string>>({});
  const [blockProfileId, setBlockProfileId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [promotionTitle, setPromotionTitle] = useState("Double credit flash promotion");
  const [promotionDays, setPromotionDays] = useState("0");
  const [promotionHours, setPromotionHours] = useState("1");
  const [promotionReason, setPromotionReason] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const refreshToken = useCallback(async () => {
    const { session } = await getSessionWithRecovery(supabase);
    const nextToken = session?.access_token ?? null;
    setToken(nextToken);
    return nextToken;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      const { session } = await getSessionWithRecovery(supabase);
      if (cancelled) return;
      setToken(session?.access_token ?? null);
      setTokenLoaded(true);
    };

    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const fetchDashboard = useCallback(
    async (currentToken: string | null) => {
      if (!currentToken) {
        setLoadState({ loading: false, error: "Sign in with a moderator account.", message: null });
        return;
      }

      setLoadState({ loading: true, error: null, message: null });
      try {
        let res = await fetch("/api/mod/dashboard", {
          headers: { Authorization: `Bearer ${currentToken}` },
          cache: "no-store",
        });

        if (res.status === 401) {
          const nextToken = await refreshToken();
          if (nextToken) {
            res = await fetch("/api/mod/dashboard", {
              headers: { Authorization: `Bearer ${nextToken}` },
              cache: "no-store",
            });
          }
        }

        const payload = (await res.json().catch(() => ({}))) as ModeratorPayload & {
          error?: string;
        };

        if (!res.ok) {
          setData(null);
          setLoadState({
            loading: false,
            error: payload.error ?? "Failed to load moderator dashboard.",
            message: null,
          });
          return;
        }

        setData(payload);
        setLoadState({ loading: false, error: null, message: null });
      } catch (error) {
        setLoadState({
          loading: false,
          error:
            error instanceof Error
              ? `Failed to refresh moderator dashboard: ${error.message}`
              : "Failed to refresh moderator dashboard.",
          message: null,
        });
      }
    },
    [refreshToken],
  );

  useEffect(() => {
    if (!tokenLoaded) return;
    const timer = window.setTimeout(() => {
      void fetchDashboard(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tokenLoaded, token, fetchDashboard]);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    }),
    [token],
  );

  const reloadAfterAction = useCallback(async () => {
    const currentToken = token ?? (await refreshToken());
    await fetchDashboard(currentToken);
  }, [fetchDashboard, refreshToken, token]);

  const runResourceAction = async (
    resourceId: string,
    action: "approve" | "reject" | "flag" | "remove" | "archive" | "restore",
    reportStatus?: "resolved" | "rejected",
  ) => {
    if (!token) return;
    setActionState({ loading: true, error: null, message: null });
    try {
      const res = await fetch(`/api/mod/resources/${resourceId}/action`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action,
          notes: selectedResourceNotes[resourceId] ?? "",
          reportStatus,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionState({ loading: false, error: payload.error ?? "Action failed.", message: null });
        return;
      }
      setActionState({ loading: false, error: null, message: "Moderation action saved." });
      setSelectedResourceNotes((prev) => ({ ...prev, [resourceId]: "" }));
      await reloadAfterAction();
    } catch (error) {
      setActionState({
        loading: false,
        error: error instanceof Error ? `Action failed: ${error.message}` : "Action failed.",
        message: null,
      });
    }
  };

  const submitBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !blockProfileId.trim()) return;
    setActionState({ loading: true, error: null, message: null });
    const res = await fetch(`/api/mod/users/${blockProfileId.trim()}/block`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ blocked: true, reason: blockReason }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setActionState({ loading: false, error: payload.error ?? "Failed to block user.", message: null });
      return;
    }
    setBlockProfileId("");
    setBlockReason("");
    setActionState({ loading: false, error: null, message: "User blocked." });
    await reloadAfterAction();
  };

  const unblockUser = async (profileId: string) => {
    if (!token) return;
    setActionState({ loading: true, error: null, message: null });
    const res = await fetch(`/api/mod/users/${profileId}/block`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ blocked: false }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setActionState({ loading: false, error: payload.error ?? "Failed to unblock user.", message: null });
      return;
    }
    setActionState({ loading: false, error: null, message: "User unblocked." });
    await reloadAfterAction();
  };

  const submitPromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const days = Math.max(0, Number(promotionDays) || 0);
    const hours = Math.max(0, Number(promotionHours) || 0);
    const durationMinutes = Math.round(days * 24 * 60 + hours * 60);

    setActionState({ loading: true, error: null, message: null });
    const res = await fetch("/api/mod/promotions", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: promotionTitle,
        durationMinutes,
        reason: promotionReason,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setActionState({
        loading: false,
        error: payload.error ?? "Failed to start promotion.",
        message: null,
      });
      return;
    }
    setPromotionReason("");
    setActionState({ loading: false, error: null, message: "Flash promotion started." });
    await reloadAfterAction();
  };

  const endPromotion = async (promotionId: string) => {
    if (!token) return;
    setActionState({ loading: true, error: null, message: null });
    const res = await fetch(`/api/mod/promotions/${promotionId}/end`, {
      method: "POST",
      headers: authHeaders,
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setActionState({ loading: false, error: payload.error ?? "Failed to end promotion.", message: null });
      return;
    }
    setActionState({ loading: false, error: null, message: "Flash promotion ended." });
    await reloadAfterAction();
  };

  const metricItems = data
    ? [
        ["Pending notes", data.metrics.pendingResources],
        ["Flagged notes", data.metrics.flaggedResources],
        ["Open reports", data.metrics.openReports],
        ["Blocked users", data.metrics.blockedUsers],
        ["Active promos", data.metrics.activePromotions],
      ]
    : [];

  const selectedResource = data?.resources.length
    ? data.resources.find((resource) => resource.id === selectedResourceId) ??
      data.resources[0] ??
      null
    : null;

  const selectedPdfFile = useMemo(() => {
    if (!selectedResource || !token) return null;
    return {
      url: `/api/mod/resources/${selectedResource.id}/view`,
      httpHeaders: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, [selectedResource, token]);

  const selectResourceForReview = (resourceId: string) => {
    setSelectedResourceId(resourceId);
    setPdfPages(null);
    setPdfError(null);
  };

  return (
    <main className="moderator-page">
      <section className="moderator-hero">
        <div>
          <p className="moderator-kicker">Moderator Console</p>
          <h1>Review notes, reports, users, and credit events.</h1>
          <p>
            Built for Supabase developer role holders. Actions here are guarded server-side and
            written to moderation tables.
          </p>
        </div>
        <button
          type="button"
          className="moderator-secondary-btn"
          onClick={() => void reloadAfterAction()}
          disabled={loadState.loading}
        >
          Refresh
        </button>
      </section>

      {loadState.error ? (
        <section className="moderator-alert moderator-alert--error">
          <strong>{loadState.error}</strong>
          <Link href="/dashboard">Return to Browse</Link>
        </section>
      ) : null}

      {actionState.error || actionState.message ? (
        <section
          className={`moderator-alert ${
            actionState.error ? "moderator-alert--error" : "moderator-alert--success"
          }`}
        >
          {actionState.error ?? actionState.message}
        </section>
      ) : null}

      {loadState.loading && !data ? (
        <section className="moderator-empty">Loading moderator workspace...</section>
      ) : null}

      {data ? (
        <>
          <section className="moderator-metrics" aria-label="Moderator metrics">
            {metricItems.map(([label, value]) => (
              <div className="moderator-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>

          <div className="moderator-layout">
            <section className="moderator-panel moderator-panel--wide">
              <div className="moderator-panel-heading">
                <div>
                  <h2>Note Review</h2>
                  <p>Oldest pending and flagged submissions are shown first.</p>
                </div>
              </div>
              {data.resources.length === 0 ? (
                <p className="moderator-empty">No pending or flagged notes right now.</p>
              ) : (
                <div className="moderator-review-workspace">
                  <div className="moderator-pdf-column">
                    {selectedResource ? (
                      <>
                        <div className="moderator-row-top">
                          <span className={`moderator-status moderator-status--${selectedResource.status}`}>
                            {selectedResource.status}
                          </span>
                          <span>Submitted {formatDateTime(selectedResource.created_at)}</span>
                        </div>
                        <h3 className="moderator-review-title">{selectedResource.title}</h3>
                        <p className="moderator-review-description">
                          {selectedResource.description ?? "No description provided."}
                        </p>
                        <div className="moderator-meta-row">
                          <span>{formatCourse(selectedResource.courses)}</span>
                          <span>{selectedResource.resource_type ?? "resource"}</span>
                          <span>Owner: {formatProfile(selectedResource.profiles)}</span>
                        </div>

                        <div className="moderator-pdf-viewer" aria-label="PDF review viewer">
                          {pdfError ? (
                            <p className="moderator-empty">{pdfError}</p>
                          ) : selectedPdfFile ? (
                            <Document
                              key={selectedResource.id}
                              file={selectedPdfFile}
                              loading={<p className="moderator-empty">Loading PDF...</p>}
                              error={<p className="moderator-empty">Unable to load this PDF.</p>}
                              onLoadSuccess={({ numPages }) => {
                                setPdfPages(numPages);
                                setPdfError(null);
                              }}
                              onLoadError={(error) => {
                                setPdfError(error.message || "Unable to load this PDF.");
                              }}
                            >
                              {Array.from({ length: pdfPages ?? 0 }, (_, index) => (
                                <div className="moderator-pdf-page" key={`page_${index + 1}`}>
                                  <Page
                                    pageNumber={index + 1}
                                    width={980}
                                    renderAnnotationLayer
                                    renderTextLayer
                                  />
                                </div>
                              ))}
                            </Document>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <aside className="moderator-decision-rail">
                    {selectedResource ? (
                      <>
                        <label className="moderator-decision-label">
                          Decision notes
                          <textarea
                            className="moderator-textarea"
                            value={selectedResourceNotes[selectedResource.id] ?? ""}
                            onChange={(event) =>
                              setSelectedResourceNotes((prev) => ({
                                ...prev,
                                [selectedResource.id]: event.target.value,
                              }))
                            }
                            placeholder="Why this note was accepted, rejected, or flagged"
                            aria-label={`Decision notes for ${selectedResource.title}`}
                          />
                        </label>
                        <div className="moderator-actions moderator-actions--decision">
                          <button
                            type="button"
                            className="moderator-primary-btn"
                            onClick={() => void runResourceAction(selectedResource.id, "approve")}
                            disabled={actionState.loading}
                          >
                            Approve Note
                          </button>
                          <button
                            type="button"
                            className="moderator-secondary-btn"
                            onClick={() => void runResourceAction(selectedResource.id, "flag")}
                            disabled={actionState.loading}
                          >
                            Keep Flagged
                          </button>
                          <button
                            type="button"
                            className="moderator-danger-btn"
                            onClick={() => void runResourceAction(selectedResource.id, "remove")}
                            disabled={actionState.loading}
                          >
                            Reject Note
                          </button>
                        </div>
                      </>
                    ) : null}
                    <div className="moderator-queue-list" aria-label="Chronological review queue">
                      {data.resources.map((resource, index) => (
                        <button
                          type="button"
                          className={`moderator-queue-item ${
                            selectedResource?.id === resource.id ? "moderator-queue-item--active" : ""
                          }`}
                          key={resource.id}
                          onClick={() => selectResourceForReview(resource.id)}
                        >
                          <span>#{index + 1}</span>
                          <strong>{resource.title}</strong>
                          <small>
                            {formatCourse(resource.courses)} · {formatDateTime(resource.created_at)}
                          </small>
                        </button>
                      ))}
                    </div>
                  </aside>
                </div>
              )}
            </section>

            <aside className="moderator-panel">
              <div className="moderator-panel-heading">
                <div>
                  <h2>Flash Promotion</h2>
                  <p>Double upload and upvote credits for a timed window.</p>
                </div>
              </div>
              <form className="moderator-form" onSubmit={submitPromotion}>
                <label>
                  Title
                  <input
                    value={promotionTitle}
                    onChange={(event) => setPromotionTitle(event.target.value)}
                  />
                </label>
                <div className="moderator-duration-grid">
                  <label>
                    Days
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="1"
                      inputMode="numeric"
                      value={promotionDays}
                      onChange={(event) => setPromotionDays(event.target.value)}
                    />
                  </label>
                  <label>
                    Hours
                    <input
                      type="number"
                      min="0"
                      max="23"
                      step="1"
                      inputMode="numeric"
                      value={promotionHours}
                      onChange={(event) => setPromotionHours(event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Reason
                  <textarea
                    value={promotionReason}
                    onChange={(event) => setPromotionReason(event.target.value)}
                    placeholder="Midterms push, new course launch, etc."
                  />
                </label>
                <button
                  type="submit"
                  className="moderator-primary-btn"
                  disabled={actionState.loading}
                >
                  Start 2x Credits
                </button>
              </form>

              <div className="moderator-promo-list">
                {data.promotions.length === 0 ? (
                  <p className="moderator-empty">No promotions yet.</p>
                ) : (
                  data.promotions.map((promotion) => (
                    <div className="moderator-promo" key={promotion.id}>
                      <div>
                        <strong>{promotion.title}</strong>
                        <span>
                          {Number(promotion.multiplier).toFixed(0)}x until{" "}
                          {formatDateTime(promotion.ends_at)}
                        </span>
                      </div>
                      {isPromotionActive(promotion) ? (
                        <button
                          type="button"
                          className="moderator-secondary-btn moderator-secondary-btn--compact"
                          onClick={() => void endPromotion(promotion.id)}
                          disabled={actionState.loading}
                        >
                          End
                        </button>
                      ) : (
                        <span className="moderator-muted">Inactive</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>

          <section className="moderator-panel">
            <div className="moderator-panel-heading">
              <div>
                <h2>Reports</h2>
                <p>Open reports from students, TAs, and instructors.</p>
              </div>
            </div>
            {data.reports.length === 0 ? (
              <p className="moderator-empty">No open reports.</p>
            ) : (
              <div className="moderator-report-grid">
                {data.reports.map((report) => (
                  <article className="moderator-report" key={report.id}>
                    <div className="moderator-row-top">
                      <span className="moderator-status moderator-status--open">
                        {report.category}
                      </span>
                      <span>Weight {report.weight}</span>
                    </div>
                    <h3>{report.resources?.title ?? "Deleted resource"}</h3>
                    <p>{report.notes}</p>
                    <div className="moderator-meta-row">
                      <span>{formatCourse(report.resources?.courses)}</span>
                      <span>Reporter: {formatProfile(report.reporter)}</span>
                      <span>Owner: {formatProfile(report.resourceOwner)}</span>
                    </div>
                    {report.resources ? (
                      <>
                        <textarea
                          className="moderator-textarea"
                          value={selectedResourceNotes[report.resource_id] ?? ""}
                          onChange={(event) =>
                            setSelectedResourceNotes((prev) => ({
                              ...prev,
                              [report.resource_id]: event.target.value,
                            }))
                          }
                          placeholder="Resolution notes"
                          aria-label={`Resolution notes for report ${report.id}`}
                        />
                        <div className="moderator-actions">
                          <button
                            type="button"
                            className="moderator-dismiss-btn"
                            onClick={() =>
                              void runResourceAction(report.resource_id, "restore", "rejected")
                            }
                            disabled={actionState.loading}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            className="moderator-secondary-btn"
                            onClick={() =>
                              void runResourceAction(report.resource_id, "flag")
                            }
                            disabled={actionState.loading}
                          >
                            Keep Flagged
                          </button>
                          <button
                            type="button"
                            className="moderator-danger-btn"
                            onClick={() =>
                              void runResourceAction(report.resource_id, "remove", "resolved")
                            }
                            disabled={actionState.loading}
                          >
                            Remove Note
                          </button>
                          {report.resourceOwner?.id ? (
                            <button
                              type="button"
                              className="moderator-danger-btn"
                              onClick={() => {
                                setBlockProfileId(report.resourceOwner?.id ?? "");
                                setBlockReason(`Report ${report.id}: ${report.category}`);
                              }}
                            >
                              Block user
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="moderator-panel">
            <div className="moderator-panel-heading">
              <div>
                <h2>User Controls</h2>
                <p>Block accounts from uploading, downloading, and reporting.</p>
              </div>
            </div>
            <div className="moderator-user-layout">
              <form className="moderator-form" onSubmit={submitBlock}>
                <label>
                  Profile ID
                  <input
                    value={blockProfileId}
                    onChange={(event) => setBlockProfileId(event.target.value)}
                    placeholder="Supabase profile UUID"
                  />
                </label>
                <label>
                  Reason
                  <textarea
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    placeholder="Academic-integrity issue, spam, abuse, etc."
                  />
                </label>
                <button
                  type="submit"
                  className="moderator-danger-btn"
                  disabled={actionState.loading || !blockProfileId.trim()}
                >
                  Block User
                </button>
              </form>
              <div className="moderator-blocked-list">
                {data.blockedUsers.length === 0 ? (
                  <p className="moderator-empty">No blocked users.</p>
                ) : (
                  data.blockedUsers.map((profile) => (
                    <article className="moderator-blocked-user" key={profile.id}>
                      <div>
                        <strong>{formatProfile(profile)}</strong>
                        <span>{profile.block_reason ?? "No reason recorded."}</span>
                      </div>
                      <button
                        type="button"
                        className="moderator-secondary-btn moderator-secondary-btn--compact"
                        onClick={() => void unblockUser(profile.id)}
                        disabled={actionState.loading}
                      >
                        Unblock
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
