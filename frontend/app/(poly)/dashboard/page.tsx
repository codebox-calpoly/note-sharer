"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CALPOLY_DEPARTMENTS, type DepartmentRecord } from "@/lib/calpoly-departments";
import { getMatchingDepartments } from "@/lib/department-search";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import {
  filterAndSortCoursesBySearchOrder,
  normalizeCourseSearchQuery,
  sortCoursesBySearchOrder,
} from "@/lib/course-search";
import { getCourseSubline } from "./course-name-utils";
import { useRegisterNavRight } from "@/app/(poly)/PolyShell";
import ProfileIcons from "./profile-icon";
import "./dashboard.css";
import "./browse.css";

type CourseOption = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  term: string | null;
  year: number | null;
  note_count: number;
};

type CourseRequestForm = {
  department: string;
  courseNumber: string;
  title: string;
  term: string;
  year: string;
  justification: string;
};

type CourseRequestStatus = "idle" | "submitting" | "success" | "error";

const emptyCourseRequest: CourseRequestForm = {
  department: "",
  courseNumber: "",
  title: "",
  term: "",
  year: "",
  justification: "",
};

type DepartmentRequestForm = {
  departmentName: string;
  justification: string;
};

type DepartmentRequestStatus = "idle" | "submitting" | "success" | "error";

const emptyDepartmentRequest: DepartmentRequestForm = {
  departmentName: "",
  justification: "",
};

export default function DashboardPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseOption[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [browseSearch, setBrowseSearch] = useState("");
  const [departmentFilterSearch, setDepartmentFilterSearch] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [freeDownloads, setFreeDownloads] = useState<number | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesLoadingMore, setCoursesLoadingMore] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRecord[]>(() => [...CALPOLY_DEPARTMENTS]);
  const [catalogYear, setCatalogYear] = useState<2526 | 2627>(2526);
  /** Number of course cards to render (paginated for performance). */
  const [visibleCourseCount, setVisibleCourseCount] = useState(80);
  /** When no department selected, whether the API has more courses to fetch. */
  const [hasMoreFromApi, setHasMoreFromApi] = useState(false);
  /** Page enter animation (leaderboard-style). */
  const [isVisible] = useState(true);
  /** When no filter: search-by-query results (cached and debounced). */
  const [searchResults, setSearchResults] = useState<CourseOption[] | null>(null);
  const [searchEnrolledResults, setSearchEnrolledResults] = useState<CourseOption[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchCacheRef = useRef<
    Map<string, { classes: CourseOption[]; enrolledClasses: CourseOption[] }>
  >(new Map());
  const searchDebounceRef = useRef<number | null>(null);

  const [isCourseRequestOpen, setIsCourseRequestOpen] = useState(false);
  const [courseRequest, setCourseRequest] =
    useState<CourseRequestForm>(emptyCourseRequest);
  const [courseRequestStatus, setCourseRequestStatus] =
    useState<CourseRequestStatus>("idle");
  const [courseRequestMessage, setCourseRequestMessage] = useState<
    string | null
  >(null);

  const [isDepartmentRequestOpen, setIsDepartmentRequestOpen] = useState(false);
  const [departmentRequest, setDepartmentRequest] =
    useState<DepartmentRequestForm>(emptyDepartmentRequest);
  const [departmentRequestStatus, setDepartmentRequestStatus] =
    useState<DepartmentRequestStatus>("idle");
  const [departmentRequestMessage, setDepartmentRequestMessage] = useState<
    string | null
  >(null);
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
      else if (!session?.access_token) setCoursesError(null);
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
    let active = true;
    const loadDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        const payload = (await res.json().catch(() => ({}))) as {
          departments?: DepartmentRecord[];
        };
        if (!active || !res.ok || !Array.isArray(payload.departments)) return;
        setDepartments(payload.departments);
      } catch {
        // Fall back to the bundled list when the departments table is not seeded yet.
      }
    };
    void loadDepartments();
    return () => {
      active = false;
    };
  }, []);

  const INITIAL_PAGE_SIZE = 200;
  const DEPARTMENT_PAGE_SIZE = 1000;

  const fetchCoursesPage = useCallback(
    async (
      token: string,
      offset: number,
      department: string | null,
      limit: number,
      catYear: number
    ): Promise<
      | { ok: true; classes: CourseOption[]; enrolledClasses: CourseOption[]; hasMore: boolean }
      | { ok: false; error: string }
    > => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.set("include_enrolled", "1");
      params.set("catalog_year", String(catYear));
      if (department?.trim()) params.set("department", department.trim());
      const res = await fetch(`/api/classes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        classes?: CourseOption[];
        enrolledClasses?: CourseOption[];
        hasMore?: boolean;
        error?: string;
      };
      if (res.status === 401) return { ok: false, error: "Not authenticated" };
      if (!res.ok) return { ok: false, error: data.error ?? res.statusText ?? "Failed to load courses" };
      return {
        ok: true,
        classes: data.classes ?? [],
        enrolledClasses: data.enrolledClasses ?? [],
        hasMore: data.hasMore ?? false,
      };
    },
    []
  );

  const fetchCoursesBySearch = useCallback(
    async (token: string, search: string, catYear: number): Promise<
      | { ok: true; classes: CourseOption[]; enrolledClasses: CourseOption[] }
      | { ok: false; error: string }
    > => {
      const normalized = normalizeCourseSearchQuery(search);
      if (!normalized) return { ok: true, classes: [], enrolledClasses: [] };
      const params = new URLSearchParams();
      params.set("search", normalized);
      params.set("limit", "500");
      params.set("include_enrolled", "1");
      params.set("catalog_year", String(catYear));
      const res = await fetch(`/api/classes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        classes?: CourseOption[];
        enrolledClasses?: CourseOption[];
        error?: string;
      };
      if (res.status === 401) return { ok: false, error: "Not authenticated" };
      if (!res.ok) return { ok: false, error: data.error ?? res.statusText ?? "Failed to search" };
      return {
        ok: true,
        classes: data.classes ?? [],
        enrolledClasses: data.enrolledClasses ?? [],
      };
    },
    []
  );

  useEffect(() => {
    if (!tokenLoaded || !accessToken) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (!active) return;
      setCoursesLoading(true);
      setCoursesLoadingMore(false);
    }, 0);
    const pageSize = selectedDepartment ? DEPARTMENT_PAGE_SIZE : INITIAL_PAGE_SIZE;

    const run = async () => {
      try {
        let res = await fetchCoursesPage(
          accessToken,
          0,
          selectedDepartment,
          pageSize,
          catalogYear,
        );
        if (res.ok === false && res.error === "Not authenticated") {
          const newToken = await refreshToken();
          if (newToken) res = await fetchCoursesPage(newToken, 0, selectedDepartment, pageSize, catalogYear);
        }
        if (!active) return;
        if (res.ok === false) {
          setCoursesError(res.error);
          setCourses([]);
          setCoursesLoading(false);
          return;
        }
        setCourses(res.classes);
        setEnrolledCourses(res.enrolledClasses);
        setCoursesError(null);
        setCoursesLoading(false);
        if (selectedDepartment) {
          setHasMoreFromApi(false);
        } else {
          setHasMoreFromApi(res.hasMore);
        }
      } catch (e) {
        if (active) {
          setCoursesError(e instanceof Error ? e.message : "Failed to load courses");
          setCourses([]);
          setCoursesLoading(false);
        }
      }
    };
    run();
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [accessToken, tokenLoaded, selectedDepartment, catalogYear, refreshToken, fetchCoursesPage]);

  const SEARCH_DEBOUNCE_MS = 280;

  useEffect(() => {
    const clearSearchDebounce = () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };

    const scheduleSearchReset = () => {
      clearSearchDebounce();
      searchDebounceRef.current = window.setTimeout(() => {
        searchDebounceRef.current = null;
        setSearchResults(null);
        setSearchEnrolledResults(null);
        setSearchLoading(false);
      }, 0);
    };

    if (selectedDepartment != null) {
      scheduleSearchReset();
      return;
    }
    const q = browseSearch.trim();
    if (!q) {
      scheduleSearchReset();
      return;
    }
    clearSearchDebounce();
    searchDebounceRef.current = window.setTimeout(() => {
      searchDebounceRef.current = null;
        const normalized = normalizeCourseSearchQuery(q);
        if (!normalized) {
          setSearchResults(null);
          setSearchEnrolledResults(null);
          setSearchLoading(false);
          return;
        }
        const cached = searchCacheRef.current.get(normalized);
        if (cached != null) {
          setSearchResults(cached.classes);
          setSearchEnrolledResults(cached.enrolledClasses);
          setSearchLoading(false);
          return;
        }
      if (!accessToken) return;
      setSearchLoading(true);
        fetchCoursesBySearch(accessToken, normalized, catalogYear)
          .then((res) => {
            if (res.ok) {
              searchCacheRef.current.set(normalized, {
                classes: res.classes,
                enrolledClasses: res.enrolledClasses,
              });
              setSearchResults(res.classes);
              setSearchEnrolledResults(res.enrolledClasses);
              setSearchLoading(false);
              return;
            }
          if (res.error === "Not authenticated") {
            refreshToken().then((newToken) => {
              if (newToken) {
                fetchCoursesBySearch(newToken, normalized, catalogYear).then((r) => {
                  if (r.ok) {
                    searchCacheRef.current.set(normalized, {
                      classes: r.classes,
                      enrolledClasses: r.enrolledClasses,
                    });
                    setSearchResults(r.classes);
                    setSearchEnrolledResults(r.enrolledClasses);
                  }
                  setSearchLoading(false);
                });
              } else setSearchLoading(false);
            });
            return;
          }
          setSearchResults([]);
          setSearchEnrolledResults([]);
          setSearchLoading(false);
        })
        .catch(() => {
          setSearchResults([]);
          setSearchEnrolledResults([]);
          setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearSearchDebounce();
    };
  }, [browseSearch, selectedDepartment, catalogYear, accessToken, refreshToken, fetchCoursesBySearch]);

  const fetchCredits = useCallback(
    async (token: string | null) => {
      if (!token) return null;
      try {
        let res = await fetch("/api/credits", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          const newToken = await refreshToken();
          if (newToken) res = await fetch("/api/credits", { headers: { Authorization: `Bearer ${newToken}` } });
        }
        if (!res.ok) return null;
        const data = (await res.json()) as { credits?: number; freeDownloads?: number };
        return {
          credits: Number.isFinite(data?.credits) ? Number(data.credits) : 0,
          freeDownloads: Number.isFinite(data?.freeDownloads) ? Number(data.freeDownloads) : 0,
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
    void load();
    return () => {
      active = false;
    };
  }, [accessToken, tokenLoaded, fetchCredits]);

  /** Departments filtered by sidebar search (substring match, updates as you type). */
  const filteredDepartments = useMemo(() => {
    const q = departmentFilterSearch.trim();
    if (!q) return departments;
    return getMatchingDepartments(departments, q);
  }, [departments, departmentFilterSearch]);

  const openCourseRequest = () => {
    setIsCourseRequestOpen(true);
    setCourseRequestStatus("idle");
    setCourseRequestMessage(null);
  };

  const closeCourseRequest = () => {
    setIsCourseRequestOpen(false);
    setCourseRequestStatus("idle");
    setCourseRequestMessage(null);
  };

  const handleCourseRequestChange =
    (field: keyof CourseRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCourseRequest((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleCourseRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCourseRequestMessage(null);

    if (!accessToken) {
      setCourseRequestStatus("error");
      setCourseRequestMessage("Not authenticated. Please sign in again.");
      return;
    }

    const dept = courseRequest.department.trim();
    const courseNumber = courseRequest.courseNumber.trim();

    if (!dept || !courseNumber) {
      setCourseRequestStatus("error");
      setCourseRequestMessage("Department and course number are required.");
      return;
    }

    const yearText = courseRequest.year.trim();
    let yearValue: number | null = null;
    if (yearText) {
      const parsedYear = Number(yearText);
      if (!Number.isFinite(parsedYear)) {
        setCourseRequestStatus("error");
        setCourseRequestMessage("Year must be a number.");
        return;
      }
      yearValue = Math.trunc(parsedYear);
    }

    setCourseRequestStatus("submitting");

    try {
      const res = await fetch("/api/course-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          department: dept,
          course_number: courseNumber,
          title: courseRequest.title.trim() || null,
          term: courseRequest.term.trim() || null,
          year: yearValue,
          justification: courseRequest.justification.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Failed to submit the request.";
        setCourseRequestStatus("error");
        setCourseRequestMessage(message);
        return;
      }

      setCourseRequestStatus("success");
      setCourseRequestMessage("Request submitted. We will review it soon.");
      setCourseRequest(emptyCourseRequest);
    } catch {
      setCourseRequestStatus("error");
      setCourseRequestMessage("Failed to submit the request. Try again.");
    }
  };

  const openDepartmentRequest = () => {
    setDepartmentRequest(emptyDepartmentRequest);
    setDepartmentRequestStatus("idle");
    setDepartmentRequestMessage(null);
    setIsDepartmentRequestOpen(true);
  };
  const closeDepartmentRequest = () => setIsDepartmentRequestOpen(false);
  const handleDepartmentRequestChange =
    (field: keyof DepartmentRequestForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDepartmentRequest((prev) => ({ ...prev, [field]: event.target.value }));
    };
  const handleDepartmentRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setDepartmentRequestMessage(null);
    if (!accessToken) {
      setDepartmentRequestStatus("error");
      setDepartmentRequestMessage("Not authenticated. Please sign in again.");
      return;
    }
    const name = departmentRequest.departmentName.trim();
    if (!name) {
      setDepartmentRequestStatus("error");
      setDepartmentRequestMessage("Department name is required.");
      return;
    }
    setDepartmentRequestStatus("submitting");
    try {
      const res = await fetch("/api/department-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          department_name: name,
          justification: departmentRequest.justification.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Failed to submit the request.";
        setDepartmentRequestStatus("error");
        setDepartmentRequestMessage(message);
        return;
      }
      setDepartmentRequestStatus("success");
      setDepartmentRequestMessage("Request submitted. We will review it soon.");
      setDepartmentRequest(emptyDepartmentRequest);
    } catch {
      setDepartmentRequestStatus("error");
      setDepartmentRequestMessage("Failed to submit the request. Try again.");
    }
  };

  /** When no filter and user has typed: use search API results (cached). Otherwise use main courses list. */
  const isSearchMode = searchResults !== null && selectedDepartment == null && browseSearch.trim().length > 0;

  /** Courses from DB, filtered by department and search. One card per unique course code (deduplicated; note_count summed across terms). */
  const allDisplayCourses = useMemo((): CourseOption[] => {
    const normalizedQuery = normalizeCourseSearchQuery(browseSearch);
    let list: CourseOption[];
    if (isSearchMode && searchResults != null) {
      list = [...searchResults];
    } else {
      list = [...courses];
      if (selectedDepartment) {
        list = list.filter((c) => c.department === selectedDepartment);
      }
      list = normalizedQuery
        ? filterAndSortCoursesBySearchOrder(list, normalizedQuery)
        : sortCoursesBySearchOrder(list, normalizedQuery);
    }
    const seen = new Map<string, CourseOption>();
    for (const c of list) {
      const key = c.code ?? `${c.department ?? ""} ${c.id}`.trim();
      const existing = seen.get(key);
      if (existing) {
        existing.note_count = (existing.note_count ?? 0) + (c.note_count ?? 0);
      } else {
        seen.set(key, { ...c, note_count: c.note_count ?? 0 });
      }
    }
    return Array.from(seen.values());
  }, [courses, selectedDepartment, browseSearch, isSearchMode, searchResults]);

  /** Reset visible count when filters/search change so we don't show a short list after narrowing. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisibleCourseCount(80);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedDepartment, browseSearch]);

  const displayedEnrolledCourses = useMemo(() => {
    const source = isSearchMode ? searchEnrolledResults ?? [] : enrolledCourses;
    const normalizedQuery = normalizeCourseSearchQuery(browseSearch);
    if (isSearchMode) return [...source];
    return normalizedQuery
      ? filterAndSortCoursesBySearchOrder(source, normalizedQuery)
      : sortCoursesBySearchOrder(source, normalizedQuery);
  }, [browseSearch, enrolledCourses, isSearchMode, searchEnrolledResults]);

  const coursesToRender = allDisplayCourses.slice(0, visibleCourseCount);
  const hasMoreToShow = visibleCourseCount < allDisplayCourses.length;
  const hasMoreToFetch = !isSearchMode && !selectedDepartment && (hasMoreFromApi || coursesLoadingMore);
  const hasMoreCourses = hasMoreToShow || hasMoreToFetch;

  const loadMoreCourses = useCallback(() => {
    if (hasMoreToShow) {
      setVisibleCourseCount((n) => Math.min(n + 80, allDisplayCourses.length));
      return;
    }
    if (hasMoreToFetch && !coursesLoadingMore && accessToken) {
      setCoursesLoadingMore(true);
      const offset = courses.length;
      let cancelled = false;
      (async () => {
        try {
          let res = await fetchCoursesPage(
            accessToken,
            offset,
            null,
            INITIAL_PAGE_SIZE,
            catalogYear,
          );
          if (res.ok === false && res.error === "Not authenticated") {
            const newToken = await refreshToken();
            if (newToken) {
              res = await fetchCoursesPage(newToken, offset, null, INITIAL_PAGE_SIZE, catalogYear);
            }
          }
        if (cancelled) return;
        if (res.ok) {
          setCourses((prev) => [...prev, ...res.classes]);
          setHasMoreFromApi(res.hasMore);
          if (!res.hasMore) setCoursesLoadingMore(false);
        } else {
          setCoursesLoadingMore(false);
          setHasMoreFromApi(false);
        }
        } catch {
          if (!cancelled) {
            setCoursesLoadingMore(false);
            setHasMoreFromApi(false);
          }
        }
      })();
      return () => { cancelled = true };
    }
  }, [hasMoreToShow, hasMoreToFetch, coursesLoadingMore, accessToken, courses.length, allDisplayCourses.length, catalogYear, refreshToken, fetchCoursesPage]);

  const clearFilters = () => {
    setSelectedDepartment(null);
  };

  const handleCatalogYearChange = (year: 2526 | 2627) => {
    setCatalogYear(year);
    setSelectedDepartment(null);
    setBrowseSearch("");
    setSearchResults(null);
    setSearchEnrolledResults(null);
    searchCacheRef.current.clear();
  };

  const hasActiveFilters = selectedDepartment != null;

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

  return (
    <div className="browse-page">
      <div className="browse-body">
        <aside
          className={`browse-sidebar page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="browse-sidebar-header">
            <h2 className="browse-sidebar-title">Filters</h2>
            <button
              type="button"
              className={`browse-clear-filters ${hasActiveFilters ? "" : "browse-clear-filters-disabled"}`}
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              aria-label="Clear all filters"
            >
              Clear all filters
            </button>
          </div>
          <div className="browse-filter-section">
            <span className="browse-filter-heading">Catalogs</span>
            <div className="browse-filter-options">
              <label className="browse-filter-checkbox">
                <input
                  type="radio"
                  name="catalog-year"
                  value="2526"
                  checked={catalogYear === 2526}
                  onChange={() => handleCatalogYearChange(2526)}
                  aria-label="2025-26 catalog"
                />
                <span>2025–26</span>
              </label>
              <label className="browse-filter-checkbox">
                <input
                  type="radio"
                  name="catalog-year"
                  value="2627"
                  checked={catalogYear === 2627}
                  onChange={() => handleCatalogYearChange(2627)}
                  aria-label="2026-28 catalog"
                />
                <span>2026–28</span>
              </label>
            </div>
          </div>
          <div className="browse-filter-section">
            <span className="browse-filter-heading">Department</span>
            <div className="browse-department-search-wrap">
              <input
                type="search"
                className="browse-department-search"
                placeholder="Search departments..."
                value={departmentFilterSearch}
                onChange={(e) => setDepartmentFilterSearch(e.target.value)}
                aria-label="Search departments"
              />
            </div>
            <div className="browse-filter-options">
              {filteredDepartments.map((dept) => (
                <button
                  key={dept.code}
                  type="button"
                  className={`browse-filter-option ${selectedDepartment === dept.code ? "active" : ""}`}
                  onClick={() => setSelectedDepartment(selectedDepartment === dept.code ? null : dept.code)}
                  title={dept.name}
                >
                  {dept.code}
                </button>
              ))}
              {filteredDepartments.length === 0 && (
                <span className="browse-empty">No departments match</span>
              )}
            </div>
          </div>
          <div className="browse-filter-section">
            <div className="browse-filter-options">
              <button
                type="button"
                className="browse-filter-option"
                onClick={openCourseRequest}
              >
                Request a new course
              </button>
              <button
                type="button"
                className="browse-filter-option"
                onClick={openDepartmentRequest}
              >
                Request a department
              </button>
            </div>
          </div>
        </aside>

        <main className="browse-main">
          {coursesError && <p className="browse-error">{coursesError}</p>}
          <div
            className={`browse-heading-wrap page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
            style={{ transitionDelay: "0ms" }}
          >
            <h1 className="browse-heading">Browse Courses</h1>
            <p className="browse-subtitle">
              Select a course to view and download notes.
            </p>
            <div className="browse-main-search-wrap">
              <svg className="browse-main-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4.35-4.35"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                className="browse-main-search"
                placeholder="Search by code or title (e.g. CSC, data structures)"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                aria-label="Search courses"
              />
            </div>
          </div>
          {(!tokenLoaded || coursesLoading) && !isSearchMode && !coursesError && (
            <p className="browse-loading" aria-live="polite">Loading courses…</p>
          )}
          {isSearchMode && searchLoading && (
            <p className="browse-loading" aria-live="polite">Searching…</p>
          )}
          {tokenLoaded && !accessToken && !coursesError && (
            <p className="browse-empty">
              <Link href="/auth">Sign in</Link> to browse courses. If your session expired, sign in again—the list loads
              only for signed-in users.
            </p>
          )}
          {tokenLoaded &&
            !!accessToken &&
            !coursesLoading &&
            !(isSearchMode && searchLoading) &&
            allDisplayCourses.length === 0 &&
            !coursesError && (
            <p className="browse-empty">
              {isSearchMode
                ? "No courses match your search."
                : selectedDepartment
                  ? "No courses in this department."
                  : "No courses in the catalog yet."}
            </p>
          )}
          {!selectedDepartment && displayedEnrolledCourses.length > 0 && (
            <section className="browse-enrolled-section">
              <div className="browse-enrolled-header">
                <h2 className="browse-section-title">Enrolled Courses</h2>
                <p className="browse-section-copy">
                  Your current classes appear first for quicker browsing.
                </p>
              </div>
              <div className="browse-course-grid browse-course-grid--enrolled">
                {displayedEnrolledCourses.map((course, index) => (
                  <div
                    key={`enrolled-${course.id}`}
                    className={`page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
                    style={{ transitionDelay: `${120 + index * 30}ms` }}
                  >
                    <Link
                      href={`/dashboard/course/${course.id}`}
                      className="browse-course-card browse-course-card--enrolled"
                    >
                      <div className="browse-course-card-top">
                        <div className="browse-course-card-info">
                          <p className="browse-course-code">{course.code ?? course.name}</p>
                          {(() => {
                            const subline = getCourseSubline(course.code);
                            return subline ? <p className="browse-course-subline">{subline}</p> : null;
                          })()}
                        </div>
                        <span className="browse-course-badge browse-course-badge--enrolled">
                          Enrolled
                        </span>
                      </div>
                      <div className="browse-course-meta">
                        {course.note_count} notes available
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
          {coursesToRender.length > 0 && !selectedDepartment && displayedEnrolledCourses.length > 0 ? (
            <div className="browse-enrolled-divider" />
          ) : null}
          <div className="browse-course-grid">
            {coursesToRender.map((course, index) => (
              <div
                key={course.id}
                className={`page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
                style={{ transitionDelay: `${200 + index * 40}ms` }}
              >
                <Link
                  href={`/dashboard/course/${course.id}`}
                  className="browse-course-card"
                >
                  <div className="browse-course-card-top">
                    <div className="browse-course-card-info">
                      <p className="browse-course-code">{course.code ?? course.name}</p>
                      {(() => {
                        const subline = getCourseSubline(course.code);
                        return subline ? <p className="browse-course-subline">{subline}</p> : null;
                      })()}
                    </div>
                    {course.department && (
                      <span className="browse-course-badge">{course.department}</span>
                    )}
                  </div>
                  <div className="browse-course-meta">
                    {course.note_count} notes available
                  </div>
                </Link>
              </div>
            ))}
          </div>
          {hasMoreCourses && (
            <div className="browse-load-more-wrap">
              <button
                type="button"
                className="browse-load-more"
                onClick={loadMoreCourses}
                disabled={hasMoreToFetch && coursesLoadingMore}
              >
                {hasMoreToShow
                  ? `Load more (${allDisplayCourses.length - visibleCourseCount} remaining)`
                  : coursesLoadingMore
                    ? "Loading…"
                    : "Load more courses"}
              </button>
            </div>
          )}
          {!isSearchMode && coursesLoadingMore && (
            <p className="browse-loading-more" aria-live="polite">Loading more courses…</p>
          )}
        </main>
      </div>

      {isCourseRequestOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="course-request-overlay"
            role="presentation"
            onClick={closeCourseRequest}
          >
            <div
              className="course-request-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-request-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="course-request-header">
                <h2 id="course-request-title" className="course-request-title">
                  Request a new course
                </h2>
                <button
                  type="button"
                  className="course-request-close"
                  onClick={closeCourseRequest}
                  aria-label="Close"
                >
                  x
                </button>
              </div>
              <form
                className="course-request-form"
                onSubmit={handleCourseRequestSubmit}
              >
                <div className="course-request-grid">
                  <label className="course-request-field">
                    <span className="course-request-label">Department *</span>
                    <input
                      className="course-request-input"
                      value={courseRequest.department}
                      onChange={handleCourseRequestChange("department")}
                      autoComplete="off"
                    />
                  </label>
                  <label className="course-request-field">
                    <span className="course-request-label">Course number *</span>
                    <input
                      className="course-request-input"
                      value={courseRequest.courseNumber}
                      onChange={handleCourseRequestChange("courseNumber")}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="course-request-field">
                  <span className="course-request-label">Course title</span>
                  <input
                    className="course-request-input"
                    value={courseRequest.title}
                    onChange={handleCourseRequestChange("title")}
                    autoComplete="off"
                  />
                </label>
                <div className="course-request-grid">
                  <label className="course-request-field">
                    <span className="course-request-label">Term</span>
                    <input
                      className="course-request-input"
                      value={courseRequest.term}
                      onChange={handleCourseRequestChange("term")}
                      autoComplete="off"
                    />
                  </label>
                  <label className="course-request-field">
                    <span className="course-request-label">Year</span>
                    <input
                      className="course-request-input"
                      value={courseRequest.year}
                      onChange={handleCourseRequestChange("year")}
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="course-request-field">
                  <span className="course-request-label">Justification</span>
                  <textarea
                    className="course-request-textarea"
                    rows={3}
                    value={courseRequest.justification}
                    onChange={handleCourseRequestChange("justification")}
                  />
                </label>
                {courseRequestMessage && (
                  <p
                    className={`course-request-message ${
                      courseRequestStatus === "error" ? "is-error" : "is-success"
                    }`}
                    role="status"
                  >
                    {courseRequestMessage}
                  </p>
                )}
                <div className="course-request-actions">
                  <button
                    type="button"
                    className="course-request-secondary"
                    onClick={closeCourseRequest}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="course-request-primary"
                    disabled={courseRequestStatus === "submitting"}
                  >
                    {courseRequestStatus === "submitting"
                      ? "Submitting..."
                      : "Submit request"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {isDepartmentRequestOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="course-request-overlay"
            role="presentation"
            onClick={closeDepartmentRequest}
          >
            <div
              className="course-request-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="department-request-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="course-request-header">
                <h2 id="department-request-title" className="course-request-title">
                  Request a new department
                </h2>
                <button
                  type="button"
                  className="course-request-close"
                  onClick={closeDepartmentRequest}
                  aria-label="Close"
                >
                  x
                </button>
              </div>
              <form
                className="course-request-form"
                onSubmit={handleDepartmentRequestSubmit}
              >
                <label className="course-request-field">
                  <span className="course-request-label">Department name *</span>
                  <input
                    className="course-request-input"
                    value={departmentRequest.departmentName}
                    onChange={handleDepartmentRequestChange("departmentName")}
                    placeholder="e.g. Mathematics, Computer Science"
                    autoComplete="off"
                  />
                </label>
                <label className="course-request-field">
                  <span className="course-request-label">Justification</span>
                  <textarea
                    className="course-request-textarea"
                    rows={3}
                    value={departmentRequest.justification}
                    onChange={handleDepartmentRequestChange("justification")}
                  />
                </label>
                {departmentRequestMessage && (
                  <p
                    className={`course-request-message ${
                      departmentRequestStatus === "error" ? "is-error" : "is-success"
                    }`}
                    role="status"
                  >
                    {departmentRequestMessage}
                  </p>
                )}
                <div className="course-request-actions">
                  <button
                    type="button"
                    className="course-request-secondary"
                    onClick={closeDepartmentRequest}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="course-request-primary"
                    disabled={departmentRequestStatus === "submitting"}
                  >
                    {departmentRequestStatus === "submitting"
                      ? "Submitting..."
                      : "Submit request"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
