"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import { useRegisterNavRight } from "@/app/(poly)/PolyShell";
import ProfileIcons from "../../profile-icon";
import { getCourseSubline } from "@/lib/catalog/calpoly-catalog";
import "../../dashboard/dashboard.css";
import "../../dashboard/browse.css";
import "../course-detail.css";
import "./note-modal.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;


type CourseOption = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  term: string | null;
  year: number | null;
  note_count: number;
};

type Note = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  class_id: string | null;
  storage_path: string | null;
  resource_type: string | null;
  previewUrl: string | null;
  previewIsPdf?: boolean;
  profile_display_name: string | null;
  upvote_count: number;
  downvote_count: number;
  score: number;
  my_vote: number | null;
  download_cost: number;
  downloaded: boolean;
  favorited: boolean;
};

const RESOURCE_TYPE_FILTER_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "All types" },
  { value: "lecture_notes", label: "Lecture Notes" },
  { value: "study_guide", label: "Study Guide" },
  { value: "class_overview", label: "Class Overview" },
];

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  lecture_notes: "Lecture Notes",
  study_guide: "Study Guide",
  class_overview: "Class Overview",
};

type ReportStatus = "idle" | "submitting" | "success" | "error";

function formatResourceType(value: string | null) {
  if (!value) return "Note";
  return RESOURCE_TYPE_LABELS[value] ?? "Note";
}

function formatUploadDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getScoreToneClass(score: number) {
  if (score > 0) return "course-detail-note-score--positive";
  if (score < 0) return "course-detail-note-score--negative";
  return "course-detail-note-score--neutral";
}

function CourseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = typeof params.classId === "string" ? params.classId : null;
  const openNoteId = searchParams.get("open");

  const [course, setCourse] = useState<CourseOption | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | null>(
    null,
  );
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteSearchInput, setNoteSearchInput] = useState("");
  const noteSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [freeDownloads, setFreeDownloads] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [favoriteSavingId, setFavoriteSavingId] = useState<string | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);
  const [noteForVotePrompt, setNoteForVotePrompt] = useState<Note | null>(null);
  const [isVotePromptOpen, setIsVotePromptOpen] = useState(false);
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [numPdfPages, setNumPdfPages] = useState<number | null>(null);
  const [pdfViewLoading, setPdfViewLoading] = useState(false);
  const [pdfViewError, setPdfViewError] = useState<string | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlobLoading, setPreviewBlobLoading] = useState(false);
  const [previewBlobError, setPreviewBlobError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  const refreshToken = useCallback(async () => {
    const { session, error } = await getSessionWithRecovery(supabase);
    if (error) return null;
    const newToken = session?.access_token ?? null;
    if (newToken) setAccessToken(newToken);
    return newToken;
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      const { session, error } = await getSessionWithRecovery(supabase);
      if (error) setCoursesError("Not authenticated");
      setAccessToken(session?.access_token ?? null);
      setTokenLoaded(true);
    };
    loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!tokenLoaded || !accessToken || !classId) return;
    let active = true;
    const fetchCourses = async () => {
      const endpoint = `/api/classes?id=${encodeURIComponent(classId)}`;
      try {
        let res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            res = await fetch(endpoint, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
          }
        }
        if (!active) return;
        if (!res.ok) {
          setCoursesError("Failed to load course");
          setCourse(null);
          return;
        }
        const data = (await res.json()) as { classes?: CourseOption[] };
        const found = data.classes?.[0] ?? null;
        setCourse(found);
        setCoursesError(found ? null : "Course not found");
      } catch {
        if (active) {
          setCoursesError("Failed to load course");
          setCourse(null);
        }
      }
    };
    fetchCourses();
    return () => {
      active = false;
    };
  }, [accessToken, tokenLoaded, classId, refreshToken]);

  const fetchCredits = useCallback(
    async (token: string | null) => {
      if (!token) return null;
      try {
        let res = await fetch("/api/credits", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken)
            res = await fetch("/api/credits", {
              headers: { Authorization: `Bearer ${newToken}` },
            });
        }
        if (!res.ok) return null;
        const data = (await res.json()) as {
          credits?: number;
          freeDownloads?: number;
        };
        return {
          credits: Number.isFinite(data?.credits) ? Number(data.credits) : 0,
          freeDownloads: Number.isFinite(data?.freeDownloads)
            ? Number(data.freeDownloads)
            : 0,
        };
      } catch {
        return null;
      }
    },
    [refreshToken],
  );

  useEffect(() => {
    if (!tokenLoaded) return;
    let active = true;
    const load = async () => {
      const payload = await fetchCredits(accessToken);
      if (!active) return;
      if (!payload) {
        setCredits(null);
        setFreeDownloads(null);
        return;
      }
      setCredits(payload.credits);
      setFreeDownloads(payload.freeDownloads);
    };
    load();
    return () => {
      active = false;
    };
  }, [accessToken, tokenLoaded, fetchCredits]);

  const browseNavRight = useMemo(
    () => (
      <>
        <span className="browse-credits-pill">Credits: {credits ?? "—"}</span>
        <span className="browse-credits-pill">
          Free downloads: {freeDownloads ?? "—"}
        </span>
        <ProfileIcons />
      </>
    ),
    [credits, freeDownloads],
  );
  useRegisterNavRight(browseNavRight);

  // Refetch notes when page comes into focus (visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && page === 1 && classId) {
        setNotesVersion((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [page, classId]);

  useEffect(() => {
    if (!tokenLoaded || !classId) return;
    const fetchNotes = async () => {
      setLoadingNotes(true);
      setNotesError(null);
      const params = new URLSearchParams();
      params.set("class_id", classId);
      params.set("page", String(page));
      params.set("page_size", "16");
      params.set("sort", sortOrder);
      params.set("_t", String(Date.now())); // Cache buster
      if (resourceTypeFilter) params.set("resource_type", resourceTypeFilter);
      if (noteSearchQuery.trim()) params.set("search", noteSearchQuery.trim());
      try {
        let res = await fetch(`/api/notes?${params.toString()}`, {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
          cache: "no-store",
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            res = await fetch(`/api/notes?${params.toString()}`, {
              headers: { Authorization: `Bearer ${newToken}` },
              cache: "no-store",
            });
          }
        }
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setNotesError(payload.error || "Failed to fetch notes");
          setHasMore(false);
          setLoadingNotes(false);
          return;
        }
        const data = (await res.json()) as {
          notes?: Note[];
          hasMore?: boolean;
        };
        const incoming = data.notes ?? [];
        if (page === 1) {
          setNotes(incoming);
        } else {
          setNotes((prev) => [...prev, ...incoming]);
        }
        setHasMore(Boolean(data.hasMore));
      } catch {
        setNotesError("Unexpected error fetching notes");
        setHasMore(false);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchNotes();
  }, [
    page,
    classId,
    sortOrder,
    resourceTypeFilter,
    noteSearchQuery,
    accessToken,
    tokenLoaded,
    refreshToken,
    notesVersion,
  ]);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
  }, [resourceTypeFilter, noteSearchQuery]);

  // Debounced live search: sync query from input as user types (300ms after last keystroke).
  useEffect(() => {
    if (noteSearchDebounceRef.current) {
      clearTimeout(noteSearchDebounceRef.current);
      noteSearchDebounceRef.current = null;
    }
    if (noteSearchInput.trim() === "") {
      setNoteSearchQuery("");
      return;
    }
    noteSearchDebounceRef.current = setTimeout(() => {
      noteSearchDebounceRef.current = null;
      setNoteSearchQuery(noteSearchInput.trim());
    }, 300);
    return () => {
      if (noteSearchDebounceRef.current) {
        clearTimeout(noteSearchDebounceRef.current);
        noteSearchDebounceRef.current = null;
      }
    };
  }, [noteSearchInput]);

  const filteredNotes = useMemo(() => {
    const list = notes.filter((n) => (ownedOnly ? n.downloaded : true));
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });
  }, [notes, ownedOnly, sortOrder]);

  // Open modal for ?open=noteId (e.g. from profile "My downloads" link).
  const [fetchingOpenNote, setFetchingOpenNote] = useState(false);

  useEffect(() => {
    if (!openNoteId || !accessToken || !tokenLoaded) return;
    const note = notes.find((n) => n.id === openNoteId);
    if (note) {
      if (note.downloaded) setOwnedOnly(true);
      setSelectedNote(note);
      setIsNoteModalOpen(true);
      setPdfViewError(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("open");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    } else if (!fetchingOpenNote && !notes.find((n) => n.id === openNoteId)) {
      setFetchingOpenNote(true);
      (async () => {
        try {
          let res = await fetch(`/api/notes?id=${openNoteId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.status === 401) {
            const newToken = await refreshToken();
            if (newToken) {
              res = await fetch(`/api/notes?id=${openNoteId}`, {
                headers: { Authorization: `Bearer ${newToken}` },
              });
            }
          }
          if (res.ok) {
            const data = await res.json() as { notes?: Note[] };
            const fetchedList = data.notes ?? [];
            if (fetchedList.length > 0) {
              setNotes(prev => {
                if (prev.find((n) => n.id === fetchedList[0].id)) return prev;
                return [fetchedList[0], ...prev];
              });
            }
          }
        } catch {
          // ignore
        } finally {
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("open");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      })();
    }
  }, [openNoteId, notes, accessToken, tokenLoaded, fetchingOpenNote, refreshToken]);

  const handleDownload = useCallback(
    async (noteId: string) => {
      if (!accessToken) {
        setDownloadError("Not authenticated. Please sign in again.");
        return;
      }
      if (downloadingId) return;
      setDownloadError(null);
      setDownloadingId(noteId);
      try {
        let res = await fetch(`/api/notes/${noteId}/download`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            res = await fetch(`/api/notes/${noteId}/download`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
          } else {
            setDownloadError("Session expired. Please sign in again.");
            setDownloadingId(null);
            return;
          }
        }
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setDownloadError(
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Failed to download note.",
          );
          setDownloadingId(null);
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        const disposition = res.headers.get("content-disposition");
        const match = disposition?.match(/filename="([^"]+)"/);
        link.href = url;
        link.download = match?.[1] || `${noteId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === noteId ? { ...n, downloaded: true } : n,
          );
          const note = prev.find((n) => n.id === noteId);
          if (note) {
            setNoteForVotePrompt({ ...note, downloaded: true });
            setIsVotePromptOpen(true);
          }
          return updated;
        });
        setSelectedNote((prev) => {
          if (!prev || prev.id !== noteId) return prev;
          return { ...prev, downloaded: true };
        });
      } catch {
        setDownloadError("Failed to download note. Try again.");
      } finally {
        setDownloadingId(null);
      }
    },
    [accessToken, downloadingId, refreshToken],
  );

  const handleVote = useCallback(
    async (noteId: string, value: 1 | -1) => {
      if (!accessToken) {
        setVoteError("Not authenticated. Please sign in again.");
        return;
      }
      if (votingId) return;
      setVoteError(null);
      setVotingId(noteId);
      try {
        let res = await fetch(`/api/notes/${noteId}/vote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ value }),
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            res = await fetch(`/api/notes/${noteId}/vote`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
              },
              body: JSON.stringify({ value }),
            });
          }
        }
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setVoteError(
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Failed to vote.",
          );
          setVotingId(null);
          return;
        }
        setNotes((prev) => {
          const n = prev.find((x) => x.id === noteId);
          const prevVote = n?.my_vote ?? 0;
          const upDelta =
            (value === 1 ? 1 : 0) - (prevVote === 1 ? 1 : 0);
          const downDelta =
            (value === -1 ? 1 : 0) - (prevVote === -1 ? 1 : 0);
          const scoreDelta = value - prevVote;
          return prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  my_vote: value,
                  upvote_count: (n.upvote_count ?? 0) + upDelta,
                  downvote_count: (n.downvote_count ?? 0) + downDelta,
                  score: (n.score ?? 0) + scoreDelta,
                }
              : n,
          );
        });
        setSelectedNote((prev) => {
          if (!prev || prev.id !== noteId) return prev;
          const prevVote = prev.my_vote ?? 0;
          const upDelta = (value === 1 ? 1 : 0) - (prevVote === 1 ? 1 : 0);
          const downDelta =
            (value === -1 ? 1 : 0) - (prevVote === -1 ? 1 : 0);
          const scoreDelta = value - prevVote;
          return {
            ...prev,
            my_vote: value,
            upvote_count: (prev.upvote_count ?? 0) + upDelta,
            downvote_count: (prev.downvote_count ?? 0) + downDelta,
            score: (prev.score ?? 0) + scoreDelta,
          };
        });
        setNotesVersion((v) => v + 1);
      } catch {
        setVoteError("Failed to vote. Try again.");
      } finally {
        setVotingId(null);
      }
    },
    [accessToken, votingId, refreshToken],
  );

  const handleOpenNoteModal = (note: Note) => {
    setSelectedNote(note);
    setIsNoteModalOpen(true);
    setVoteError(null);
  };

  const handleCloseNoteModal = () => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = null;
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setIsNoteModalOpen(false);
    setSelectedNote(null);
    setIsReportOpen(false);
    setPdfViewUrl(null);
    setPdfPageNumber(1);
    setNumPdfPages(null);
    setPdfViewError(null);
    setPreviewBlobUrl(null);
    setPreviewBlobError(null);
  };

  // When modal opens with a downloaded note, fetch PDF as blob and show in viewer (same as upload preview).
  useEffect(() => {
    if (!isNoteModalOpen || !selectedNote || !selectedNote.downloaded || !accessToken) {
      setPdfViewUrl(null);
      setPdfViewError(null);
      return;
    }
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = null;
    }
    let cancelled = false;
    setPdfViewLoading(true);
    setPdfViewError(null);
    setPdfViewUrl(null);
    setPdfPageNumber(1);
    setNumPdfPages(null);
    (async () => {
      try {
        let res = await fetch(`/api/notes/${selectedNote.id}/view?stream=1`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken)
            res = await fetch(`/api/notes/${selectedNote.id}/view?stream=1`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
        }
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text();
          let msg = "Could not load note for viewing.";
          try {
            const body = JSON.parse(text) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            if (text) msg = text.slice(0, 100);
          }
          setPdfViewError(msg);
          setPdfViewLoading(false);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = blobUrl;
        setPdfViewUrl(blobUrl);
      } catch {
        if (!cancelled) setPdfViewError("Failed to load note for viewing.");
      } finally {
        if (!cancelled) setPdfViewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNoteModalOpen, selectedNote, selectedNote?.id, selectedNote?.downloaded, accessToken, refreshToken]);

  // For non-downloaded notes: fetch preview with auth so it actually loads (img/iframe don't send cookies).
  useEffect(() => {
    if (
      !isNoteModalOpen ||
      !selectedNote ||
      selectedNote.downloaded ||
      !selectedNote.previewUrl ||
      !accessToken
    ) {
      setPreviewBlobUrl(null);
      setPreviewBlobError(null);
      return;
    }
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    let cancelled = false;
    setPreviewBlobLoading(true);
    setPreviewBlobError(null);
    setPreviewBlobUrl(null);
    const previewUrl = selectedNote.previewUrl;
    (async () => {
      try {
        let res = await fetch(previewUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken)
            res = await fetch(previewUrl, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
        }
        if (cancelled) return;
        if (!res.ok) {
          setPreviewBlobError("Preview could not be loaded.");
          setPreviewBlobLoading(false);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        previewBlobUrlRef.current = blobUrl;
        setPreviewBlobUrl(blobUrl);
      } catch {
        if (!cancelled) setPreviewBlobError("Preview could not be loaded.");
      } finally {
        if (!cancelled) setPreviewBlobLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isNoteModalOpen,
    selectedNote,
    selectedNote?.id,
    selectedNote?.downloaded,
    selectedNote?.previewUrl,
    accessToken,
    refreshToken,
  ]);

  const handleReportNote = () => {
    if (!selectedNote) return;
    setReportReason("");
    setReportStatus("idle");
    setReportMessage(null);
    setIsReportOpen(true);
  };

  const handleToggleStar = useCallback(async (noteId: string) => {
    if (!accessToken || favoriteSavingId === noteId) return;
    const targetNote =
      notes.find((note) => note.id === noteId) ??
      (selectedNote?.id === noteId ? selectedNote : null);
    if (!targetNote) return;
    const prevFavorited = Boolean(targetNote.favorited);
    const nextFavorited = !Boolean(targetNote.favorited);

    // Optimistic UI: flip star immediately for snappy feedback.
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, favorited: nextFavorited } : note
      )
    );
    setSelectedNote((prev) =>
      prev && prev.id === noteId ? { ...prev, favorited: nextFavorited } : prev
    );

    setFavoriteSavingId(noteId);
    try {
      let res = await fetch(`/api/notes/${noteId}/favorite`, {
        method: nextFavorited ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 401) {
        const newToken = await refreshToken();
        if (newToken) {
          res = await fetch(`/api/notes/${noteId}/favorite`, {
            method: nextFavorited ? "POST" : "DELETE",
            headers: { Authorization: `Bearer ${newToken}` },
          });
        }
      }
      if (!res.ok) {
        throw new Error("Failed to save favorite.");
      }
    } catch {
      // Revert optimistic update if server call fails.
      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId ? { ...note, favorited: prevFavorited } : note
        )
      );
      setSelectedNote((prev) =>
        prev && prev.id === noteId ? { ...prev, favorited: prevFavorited } : prev
      );
    } finally {
      setFavoriteSavingId(null);
    }
  }, [notes, selectedNote, accessToken, favoriteSavingId, refreshToken]);

  const handleCloseReport = () => {
    setIsReportOpen(false);
    setReportReason("");
    setReportStatus("idle");
    setReportMessage(null);
  };

  const handleSubmitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedNote) return;
    const trimmedReason = reportReason.trim();
    if (!trimmedReason) return;
    setReportStatus("submitting");
    setReportMessage(null);
    try {
      let token = accessToken;
      if (!token) {
        token = await refreshToken();
      }
      if (!token) {
        setReportStatus("error");
        setReportMessage("Sign in again to report this note.");
        return;
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resourceId: selectedNote.id,
          category: "other",
          notes: trimmedReason,
        }),
      });
      if (!res.ok) {
        setReportStatus("error");
        setReportMessage("Failed to send report. Please try again.");
        return;
      }
      setReportStatus("success");
      setReportMessage("Thanks for reporting. We'll review this note.");
      setReportReason("");
    } catch {
      setReportStatus("error");
      setReportMessage("Failed to send report. Please try again.");
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingNotes) setPage((p) => p + 1);
  };

  const selectedNoteIsStarred = Boolean(selectedNote?.favorited);
  const selectedNoteFavoriteSaving =
    selectedNote != null && favoriteSavingId === selectedNote.id;

  if (!classId) {
    return (
      <div className="course-detail-page">
        <p className="course-detail-error">Invalid course.</p>
        <Link href="/dashboard">Back to Browse</Link>
      </div>
    );
  }

  if (coursesError && !course) {
    return (
      <div className="course-detail-page">
        <div className="course-detail-body">
          <p className="course-detail-error">{coursesError}</p>
          <Link href="/dashboard">Back to Browse</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="course-detail-page">
      <div className="course-detail-body">
        <>
          <header className="course-detail-header">
            <div className="course-detail-header-info">
              <h1 className="course-detail-title">{course ? (course.code ?? course.name) : "Loading course…"}</h1>
              {(() => {
                if (!course) return null;
                const subline = getCourseSubline(course.code);
                return subline ? <p className="course-detail-subline">{subline}</p> : null;
              })()}
            </div>
            {course ? (
              <Link
                href={`/upload?course=${course.id}`}
                className="course-detail-add-note"
              >
                Add Note
              </Link>
            ) : null}
          </header>

          <div className="course-detail-filters">
            <div className="course-detail-filter-group course-detail-search-row">
              <label htmlFor="note-search" className="course-detail-filter-label">
                Search notes:
              </label>
              <input
                id="note-search"
                type="search"
                placeholder="Keywords in title or description…"
                value={noteSearchInput}
                onChange={(e) => setNoteSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (noteSearchDebounceRef.current) {
                      clearTimeout(noteSearchDebounceRef.current);
                      noteSearchDebounceRef.current = null;
                    }
                    setNoteSearchQuery(noteSearchInput.trim());
                  }
                }}
                className="course-detail-search-input"
                aria-label="Search notes by keyword"
              />
              {noteSearchInput ? (
                <button
                  type="button"
                  className="course-detail-filter-btn"
                  onClick={() => {
                    setNoteSearchInput("");
                    setNoteSearchQuery("");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="course-detail-filter-group">
              <span className="course-detail-filter-label">Filter:</span>
              <button
                type="button"
                className={`course-detail-filter-btn ${ownedOnly ? "active" : ""}`}
                onClick={() => setOwnedOnly((value) => !value)}
              >
                {ownedOnly ? "Owned only" : "Owned"}
              </button>
            </div>
            <div className="course-detail-filter-group">
              <span className="course-detail-filter-label">Type:</span>
              {RESOURCE_TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`course-detail-filter-btn ${resourceTypeFilter === opt.value ? "active" : ""}`}
                  onClick={() => {
                    setResourceTypeFilter(opt.value);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="course-detail-filter-group">
              <span className="course-detail-filter-label">Sort:</span>
              <button
                type="button"
                className={`course-detail-filter-btn ${sortOrder === "newest" ? "active" : ""}`}
                onClick={() => {
                  setSortOrder("newest");
                  setPage(1);
                  setNotesVersion((v) => v + 1);
                }}
              >
                Newest
              </button>
              <button
                type="button"
                className={`course-detail-filter-btn ${sortOrder === "oldest" ? "active" : ""}`}
                onClick={() => {
                  setSortOrder("oldest");
                  setPage(1);
                  setNotesVersion((v) => v + 1);
                }}
              >
                Oldest
              </button>
            </div>
            <span className="course-detail-notes-count">
              {filteredNotes.length} notes available
            </span>
            <button
              type="button"
              className="course-detail-refresh-btn"
              onClick={() => {
                setPage(1);
                setNotesVersion((v) => v + 1);
              }}
              disabled={loadingNotes}
              title="Refresh notes"
            >
              {loadingNotes ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {downloadError && (
            <p className="course-detail-error">{downloadError}</p>
          )}
          {voteError && (
            <p className="course-detail-error" role="alert">
              {voteError}
            </p>
          )}
          {notesError && (
            <p className="course-detail-error">{notesError}</p>
          )}

          <div className="course-detail-note-grid">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="course-detail-note-card"
                onClick={() => handleOpenNoteModal(note)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  handleOpenNoteModal(note);
                }}
              >
                <div className="course-detail-note-header">
                  <h3 className="course-detail-note-title">{note.title}</h3>
                  <button
                    type="button"
                    className={`course-detail-note-star ${note.favorited ? "is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleToggleStar(note.id);
                    }}
                    aria-pressed={note.favorited}
                    disabled={favoriteSavingId === note.id || !accessToken}
                    title={note.favorited ? "Remove bookmark" : "Save bookmark"}
                    aria-label={note.favorited ? "Remove bookmark" : "Save bookmark"}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="course-detail-note-bookmark-icon">
                      <path
                        d="M7 4.75A1.75 1.75 0 0 1 8.75 3h6.5A1.75 1.75 0 0 1 17 4.75V21l-5-3.15L7 21V4.75Z"
                        fill={note.favorited ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="course-detail-note-secondary">
                  <span className="course-detail-note-type">{formatResourceType(note.resource_type)}</span>
                  <span className="course-detail-note-date">{formatUploadDate(note.created_at)}</span>
                </div>
                <div className="course-detail-note-meta">
                  <span
                    className={`course-detail-note-score ${getScoreToneClass(note.score ?? 0)}`}
                  >
                    Score: {note.score ?? 0}
                  </span>
                  <span className="course-detail-note-credits">
                    {note.downloaded ? "Owned" : `Download: ${note.download_cost} credits`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {loadingNotes && (
            <p className="course-detail-loading">Loading notes…</p>
          )}
          {!loadingNotes && hasMore && (
            <button
              type="button"
              className="course-detail-load-more"
              onClick={handleLoadMore}
            >
              Load more
            </button>
          )}
          {!loadingNotes &&
            filteredNotes.length === 0 &&
            !notesError && (
              <p className="course-detail-empty">No notes in this course yet.</p>
            )}
        </>
      </div>

      {/* Note preview modal – download only from modal */}
      {isNoteModalOpen && selectedNote && typeof document !== "undefined" && createPortal(
        <div
          className="note-modal-overlay"
          role="presentation"
          onClick={handleCloseNoteModal}
        >
          <div
            className="note-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="note-modal-header">
              <div className="note-modal-header-text">
                <h2 id="note-modal-title" className="note-modal-title">
                  {selectedNote.title}
                </h2>
                {selectedNote.description && (
                  <p className="note-modal-description">{selectedNote.description}</p>
                )}
              </div>
              <button
                type="button"
                className="note-modal-close"
                onClick={handleCloseNoteModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="note-modal-content">
              <div
                className={`note-modal-preview ${
                  selectedNote.downloaded && pdfViewUrl
                    ? "note-modal-preview--pdf"
                    : ""
                }`}
              >
                {selectedNote.downloaded ? (
                  <>
                    {pdfViewLoading && (
                      <div className="note-modal-pdf-loading">
                        Loading note…
                      </div>
                    )}
                    {pdfViewError && (
                      <div className="note-modal-pdf-error">
                        {pdfViewError}
                      </div>
                    )}
                    {!pdfViewLoading && !pdfViewError && pdfViewUrl && (
                      <div className="note-modal-pdf-viewer">
                        <div className="note-modal-pdf-scroll">
                          <Document
                            key={selectedNote.id}
                            file={pdfViewUrl}
                            onLoadSuccess={({ numPages }) => {
                              setNumPdfPages(numPages);
                              setPdfPageNumber(1);
                            }}
                            loading={
                              <div className="note-modal-pdf-loading">
                                Loading PDF…
                              </div>
                            }
                            error={
                              <div className="note-modal-pdf-error">
                                Failed to load PDF
                              </div>
                            }
                          >
                            <Page
                              pageNumber={pdfPageNumber}
                              width={
                                Math.min(
                                  560,
                                  typeof window !== "undefined"
                                    ? Math.min(window.innerWidth - 80, 560)
                                    : 560
                                )
                              }
                              renderAnnotationLayer={false}
                              renderTextLayer={true}
                            />
                          </Document>
                        </div>
                        <div className="note-modal-pdf-nav">
                          <button
                            type="button"
                            onClick={() =>
                              setPdfPageNumber((p) => Math.max(1, p - 1))
                            }
                            disabled={pdfPageNumber <= 1}
                            className="note-modal-pdf-nav-btn"
                            aria-label="Previous page"
                          >
                            Previous
                          </button>
                          <span className="note-modal-pdf-page-info">
                            Page {pdfPageNumber} of {numPdfPages ?? "…"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPdfPageNumber((p) =>
                                Math.min(numPdfPages ?? 1, p + 1)
                              )
                            }
                            disabled={
                              numPdfPages == null ||
                              pdfPageNumber >= numPdfPages
                            }
                            className="note-modal-pdf-nav-btn"
                            aria-label="Next page"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : selectedNote.previewUrl ? (
                  <>
                    {previewBlobLoading && (
                      <div className="note-modal-pdf-loading">
                        Loading preview…
                      </div>
                    )}
                    {previewBlobError && (
                      <div className="note-modal-pdf-error">
                        {previewBlobError}
                      </div>
                    )}
                    {!previewBlobLoading && !previewBlobError && previewBlobUrl && (
                      selectedNote.previewIsPdf ? (
                        <iframe
                          src={previewBlobUrl}
                          title="Note preview (blurred until downloaded)"
                          className="note-modal-preview-iframe"
                        />
                      ) : (
                        // Blob URLs come from authenticated preview fetches, so Next Image cannot optimize them.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewBlobUrl}
                          alt="Note preview (blurred until downloaded)"
                          className="note-modal-preview-img"
                        />
                      )
                    )}
                  </>
                ) : (
                  <div className="note-modal-no-preview">
                    No preview available. Download to view.
                  </div>
                )}
              </div>
              <div className="note-modal-details">
                <p>
                  <strong>Uploader:</strong>{" "}
                  {selectedNote.profile_display_name ?? "Unknown"}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(selectedNote.created_at).toLocaleDateString()}
                </p>
                <p>
                  <strong>Download:</strong>{" "}
                  {selectedNote.downloaded
                    ? "You have this (re-download free)"
                    : `Download: ${selectedNote.download_cost} credits`}
                </p>
                <p
                  className={`note-modal-score-hint ${getScoreToneClass(selectedNote.score ?? 0)}`}
                  title="Net score"
                >
                  Score: {selectedNote.score ?? 0}
                </p>
                <p>
                  <strong>Type:</strong> {formatResourceType(selectedNote.resource_type)}
                </p>
              </div>
            </div>
            <div className="note-modal-actions">
              <button
                type="button"
                className="note-modal-download-btn"
                onClick={() => handleDownload(selectedNote.id)}
                disabled={downloadingId === selectedNote.id}
                title={
                  selectedNote.downloaded
                    ? "Re-download (free)"
                    : `Download (${selectedNote.download_cost} credits)`
                }
              >
                {downloadingId === selectedNote.id
                  ? "Preparing…"
                  : selectedNote.downloaded
                    ? "Download again"
                    : `Download (${selectedNote.download_cost} credits)`}
              </button>
              <div className="note-modal-actions-votes">
                <button
                  type="button"
                  className={`note-modal-vote-arrow note-modal-vote-up ${selectedNote.my_vote === 1 ? "note-modal-vote-active" : ""}`}
                  onClick={() => handleVote(selectedNote.id, 1)}
                  disabled={
                    !selectedNote.downloaded || votingId === selectedNote.id
                  }
                  title={
                    selectedNote.downloaded
                      ? "Upvote this note"
                      : "Download this note to vote"
                  }
                  aria-label="Upvote"
                >
                  <span className="note-modal-vote-arrow-icon">↑</span>
                  <span className="note-modal-vote-count">Upvote</span>
                </button>
                <button
                  type="button"
                  className={`note-modal-vote-arrow note-modal-vote-down ${selectedNote.my_vote === -1 ? "note-modal-vote-active" : ""}`}
                  onClick={() => handleVote(selectedNote.id, -1)}
                  disabled={
                    !selectedNote.downloaded || votingId === selectedNote.id
                  }
                  title={
                    selectedNote.downloaded
                      ? "Downvote this note"
                      : "Download this note to vote"
                  }
                  aria-label="Downvote"
                >
                  <span className="note-modal-vote-arrow-icon">↓</span>
                  <span className="note-modal-vote-count">Downvote</span>
                </button>
              </div>
              <div className="note-modal-actions-secondary">
                <button
                  type="button"
                  className="note-modal-report-btn"
                  onClick={handleReportNote}
                >
                  Report
                </button>
                <button
                  type="button"
                  className={`note-modal-star-btn ${selectedNoteIsStarred ? "is-active" : ""}`}
                  onClick={() => {
                    void handleToggleStar(selectedNote.id);
                  }}
                  aria-pressed={selectedNoteIsStarred}
                  disabled={selectedNoteFavoriteSaving}
                  title={selectedNoteIsStarred ? "Remove bookmark" : "Save bookmark"}
                  aria-label={selectedNoteIsStarred ? "Remove bookmark" : "Save bookmark"}
                >
                  {selectedNoteIsStarred ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                      <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
                      <path d="M5 3a2 2 0 0 0-2 2v16l9-4 9 4V5a2 2 0 0 0-2-2H5z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Vote prompt after download */}
      {isVotePromptOpen && noteForVotePrompt && (
        <div
          className="vote-prompt-overlay"
          role="presentation"
          onClick={() => {
            setIsVotePromptOpen(false);
            setNoteForVotePrompt(null);
            setVoteError(null);
          }}
        >
          <div
            className="vote-prompt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vote-prompt-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vote-prompt-header">
              <h3 id="vote-prompt-title" className="vote-prompt-title">
                Rate this note
              </h3>
              <button
                type="button"
                className="vote-prompt-close"
                onClick={() => {
                  setIsVotePromptOpen(false);
                  setNoteForVotePrompt(null);
                  setVoteError(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="vote-prompt-subtitle">
              You downloaded &quot;{noteForVotePrompt.title}&quot;. How was it?
            </p>
            <div className="vote-prompt-actions">
              <button
                type="button"
                className={`note-modal-vote-arrow note-modal-vote-up ${noteForVotePrompt.my_vote === 1 ? "note-modal-vote-active" : ""}`}
                onClick={() => {
                  handleVote(noteForVotePrompt.id, 1);
                  setIsVotePromptOpen(false);
                  setNoteForVotePrompt(null);
                  setVoteError(null);
                }}
                disabled={votingId === noteForVotePrompt.id}
                aria-label="Upvote"
              >
                <span className="note-modal-vote-arrow-icon">↑</span>
                <span className="note-modal-vote-count">Upvote</span>
              </button>
              <button
                type="button"
                className={`note-modal-vote-arrow note-modal-vote-down ${noteForVotePrompt.my_vote === -1 ? "note-modal-vote-active" : ""}`}
                onClick={() => {
                  handleVote(noteForVotePrompt.id, -1);
                  setIsVotePromptOpen(false);
                  setNoteForVotePrompt(null);
                  setVoteError(null);
                }}
                disabled={votingId === noteForVotePrompt.id}
                aria-label="Downvote"
              >
                <span className="note-modal-vote-arrow-icon">↓</span>
                <span className="note-modal-vote-count">Downvote</span>
              </button>
            </div>
            {voteError && (
              <p className="dashboard-vote-error" role="alert">
                {voteError}
              </p>
            )}
            <button
              type="button"
              className="vote-prompt-skip"
              onClick={() => {
                setIsVotePromptOpen(false);
                setNoteForVotePrompt(null);
                setVoteError(null);
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {isReportOpen && selectedNote && typeof document !== "undefined" && createPortal(
        <div
          className="report-modal-overlay"
          role="presentation"
          onClick={handleCloseReport}
        >
          <div
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="report-modal-header">
              <h3 id="report-modal-title" className="report-modal-title">
                Report note
              </h3>
              <button
                type="button"
                className="report-modal-close"
                onClick={handleCloseReport}
                aria-label="Close report form"
              >
                ×
              </button>
            </div>
            <p className="report-modal-subtitle">
              Reporting: <span>{selectedNote.title}</span> (ID: {selectedNote.id})
            </p>
            <form className="report-modal-form" onSubmit={handleSubmitReport}>
              <label className="report-modal-label" htmlFor="report-reason">
                Why are you reporting this note?
              </label>
              <textarea
                id="report-reason"
                name="reason"
                className="report-modal-textarea"
                placeholder="Tell us what's wrong with this note."
                rows={5}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                disabled={reportStatus === "submitting"}
                required
              />
              {reportMessage && (
                <p
                  className={
                    reportStatus === "success"
                      ? "report-modal-message success"
                      : "report-modal-message error"
                  }
                >
                  {reportMessage}
                </p>
              )}
              <div className="report-modal-actions">
                <button
                  type="button"
                  className="report-modal-cancel"
                  onClick={handleCloseReport}
                  disabled={reportStatus === "submitting"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="report-modal-submit"
                  disabled={
                    reportStatus === "submitting" || !reportReason.trim()
                  }
                >
                  {reportStatus === "submitting"
                    ? "Sending…"
                    : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default function CourseDetailPageWithSearchParams() {
  return (
    <Suspense fallback={<p className="course-detail-loading">Loading…</p>}>
      <CourseDetailPage />
    </Suspense>
  );
}
