// app/upload/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CALPOLY_DEPARTMENTS, type DepartmentRecord } from "@/lib/calpoly-departments";
import { getFacultyByDepartment } from "@/lib/calpoly-faculty";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import { useRegisterNavRight } from "@/app/(poly)/PolyShell";
import ProfileIcons from "@/app/(poly)/profile-icon";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { CALPOLY_PLACEHOLDER_COURSES } from "@/lib/catalog/calpoly-catalog";
import "./upload.css";
import "../course-request.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type ClassOption = {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  term: string | null;
  year: number | null;
  note_count: number;
};

const resourceTypeOptions = [
  { label: "Lecture Notes", value: "lecture_notes" },
  { label: "Study Guide", value: "study_guide" },
  { label: "Class Overview", value: "class_overview" },
] as const;

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

export default function UploadPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classNumberInput, setClassNumberInput] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [classNotFoundError, setClassNotFoundError] = useState<string | null>(null);
  const [isClassListOpen, setIsClassListOpen] = useState(false);
  const [department, setDepartment] = useState<string>("");
  const [departments, setDepartments] = useState<DepartmentRecord[]>(() => [...CALPOLY_DEPARTMENTS]);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);

  const [tokenLoaded, setTokenLoaded] = useState(false);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [description, setDescription] = useState("");
  const [professor, setProfessor] = useState("");
  const [isAddingProfessor, setIsAddingProfessor] = useState(false);
  const [customProfessor, setCustomProfessor] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible] = useState(true);

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

  useEffect(() => {
    (async () => {
      const { session, error } = await getSessionWithRecovery(supabase);
      if (error) console.log("UploadPage getSession error:", error);
      if (!session) {
        router.replace("/auth");
        return;
      }
    })();
  }, [router]);

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

  useEffect(() => {
    const loadSession = async () => {
      const { session, error } = await getSessionWithRecovery(supabase);
      if (error) setClassesError("Not authenticated");
      setAccessToken(session?.access_token ?? null);
      setTokenLoaded(true);
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (!tokenLoaded || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/credits", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { credits?: number };
          const nextCredits =
            typeof data?.credits === "number" && Number.isFinite(data.credits) ? data.credits : 0;
          setCredits(nextCredits);
        } else {
          setCredits(null);
        }
      } catch {
        if (!cancelled) setCredits(null);
      }
    })();
    return () => { cancelled = true; };
  }, [tokenLoaded, accessToken]);

  const openCourseRequest = () => {
    setIsClassListOpen(false);
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

  useEffect(() => {
    if (!tokenLoaded || !accessToken || !department.trim()) {
      setClasses([]);
      setClassId("");
      setClassNumberInput("");
      setClassNotFoundError(null);
      return;
    }
    let cancelled = false;
    setClasses([]);
    setClassId("");
    setClassNumberInput("");
    setClassNotFoundError(null);
    setClassesLoading(true);
    setClassesError(null);
    const fetchClasses = async () => {
      try {
        const res = await fetch(
          `/api/classes?limit=1000&offset=0&department=${encodeURIComponent(department.trim())}&catalog_year=2526`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (cancelled) return;
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setClassesError((payload as { error?: string }).error || "Failed to load classes");
          setClasses([]);
          setClassesLoading(false);
          return;
        }
        const data = (await res.json()) as { classes?: ClassOption[] };
        const apiClasses = data.classes ?? [];
        const dept = department.trim().toUpperCase();
        const fallback =
          apiClasses.length === 0 && dept
            ? CALPOLY_PLACEHOLDER_COURSES.filter(
                (c) => (c.department ?? "").toUpperCase() === dept
              ).map(
                (c): ClassOption => ({
                  id: `placeholder:${c.code}`,
                  name: c.name,
                  code: c.code,
                  department: c.department,
                  term: null,
                  year: null,
                  note_count: 0,
                })
              )
            : [];
        setClasses(apiClasses.length > 0 ? apiClasses : fallback);
        setClassId("");
        setClassNumberInput("");
        setClassNotFoundError(null);
        setClassesError(null);
      } catch {
        if (!cancelled) {
          setClassesError("Failed to load classes");
          setClasses([]);
        }
      }
      if (!cancelled) setClassesLoading(false);
    };
    fetchClasses();
    return () => { cancelled = true; };
  }, [tokenLoaded, accessToken, department]);

  const displayClasses = useMemo(() => {
    const dept = department.trim().toUpperCase();
    if (!dept) return [];
    if (classes.length > 0) return classes;
    return CALPOLY_PLACEHOLDER_COURSES.filter(
      (c) => (c.department ?? "").toUpperCase() === dept
    ).map(
      (c): ClassOption => ({
        id: `placeholder:${c.code}`,
        name: c.name,
        code: c.code,
        department: c.department,
        term: null,
        year: null,
        note_count: 0,
      })
    );
  }, [department, classes]);

  const matchingClasses = useMemo(() => {
    const q = classNumberInput.trim().toUpperCase().replace(/\s+/g, " ");
    if (!q) return [];
    const filtered = displayClasses.filter((c) => {
      const code = (c.code ?? "").trim().toUpperCase();
      return code.includes(q) || code.startsWith(q);
    });
    // Deduplicate by course code (e.g. AERO 2200) so we show one option per course, not per term.
    const byCode = new Map<string, ClassOption>();
    for (const c of filtered) {
      const code = (c.code ?? c.name ?? "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!code) continue;
      const existing = byCode.get(code);
      if (!existing || (c.note_count ?? 0) > (existing.note_count ?? 0)) {
        byCode.set(code, c);
      }
    }
    return Array.from(byCode.values());
  }, [displayClasses, classNumberInput]);

  const matchClassFromInput = useCallback((): string | null => {
    const q = classNumberInput.trim();
    setClassNotFoundError(null);
    if (!q) {
      setClassId("");
      return null;
    }
    if (classesLoading) return null;
    const normalized = q.toUpperCase().replace(/\s+/g, " ").trim();
    const numOnly = normalized.replace(/^[A-Z]+\s*/i, "").trim() || normalized;
    const matches = displayClasses.filter((c) => {
      const code = (c.code ?? "").trim().toUpperCase().replace(/\s+/g, " ");
      if (code === normalized) return true;
      if (code.endsWith(" " + normalized)) return true;
      if (code.endsWith(" " + numOnly)) return true;
      const codeNum = code.replace(/^[A-Z]+\s*/i, "").trim();
      if (codeNum === numOnly || codeNum === normalized) return true;
      return false;
    });
    if (matches.length === 0) {
      setClassId("");
      setClassNotFoundError("No class found for that number. Check the code or request a new course.");
      return null;
    }
    // Deduplicate by course code (same course in multiple terms = one choice); pick the one with most notes.
    const byCode = new Map<string, ClassOption>();
    for (const c of matches) {
      const code = (c.code ?? c.name ?? "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!code) continue;
      const existing = byCode.get(code);
      if (!existing || (c.note_count ?? 0) > (existing.note_count ?? 0)) {
        byCode.set(code, c);
      }
    }
    const uniqueMatches = Array.from(byCode.values());
    if (uniqueMatches.length > 1) {
      setClassId("");
      setClassNotFoundError("Multiple classes match — enter full code (e.g. CSC 101).");
      return null;
    }
    setClassId(uniqueMatches[0].id);
    setClassNotFoundError(null);
    return uniqueMatches[0].id;
  }, [classNumberInput, displayClasses, classesLoading]);

  useEffect(() => {
    if (!isSuccess) return;
    const t = window.setTimeout(() => {
      if (classId) {
        router.push(`/course/${classId}`);
      } else {
        router.push("/dashboard");
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [isSuccess, router, classId]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    if (selectedFile) {
      setFilePreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") handleFileChange(f);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsUploading(true);
    setIsSuccess(false);

    if (!file) {
      setSubmitError("Please add a file first.");
      setIsUploading(false);
      return;
    }
    if (!classId) {
      setSubmitError("Please select a class.");
      setIsUploading(false);
      return;
    }
    if (!title.trim()) {
      setSubmitError("Please enter a note title.");
      setIsUploading(false);
      return;
    }
    if (!resourceType) {
      setSubmitError("Please select a resource type.");
      setIsUploading(false);
      return;
    }
    if (!description.trim()) {
      setSubmitError("Please add a short description for your note.");
      setIsUploading(false);
      return;
    }
    if (!accessToken) {
      setSubmitError("Please sign in again.");
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", classId);
    formData.append("title", title.trim());
    formData.append("resource_type", resourceType);
    formData.append("description", description.trim());
    if (professor.trim()) formData.append("professor", professor.trim());

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          typeof payload === "object" && payload && "error" in payload
            ? String(payload.error)
            : "Upload failed. Try again."
        );
        setIsUploading(false);
        return;
      }
      setIsSuccess(true);
    } catch {
      setSubmitError("Upload failed. Check your connection and retry.");
    } finally {
      setIsUploading(false);
    }
  };

  const uploadNavRight = useMemo(
    () => (
      <>
        {credits != null && (
          <span className="upload-nav-credits">Credits: {credits}</span>
        )}
        <ProfileIcons />
      </>
    ),
    [credits],
  );
  useRegisterNavRight(uploadNavRight);

  if (isUploading) {
    return (
      <main className="upload-status-screen">
        <div className="upload-status-card">
          <div className="upload-spinner" aria-hidden="true" />
          <h1 className="upload-status-title">Uploading your notes…</h1>
          <p className="upload-status-subtitle">Hang tight while we save your file.</p>
        </div>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="upload-status-screen">
        <div className="upload-status-card">
          <div className="upload-success-check" aria-hidden="true">✓</div>
          <h1 className="upload-status-title">Upload request received</h1>
          <p className="upload-status-subtitle">
            Your note will be reviewed by a moderator before it appears in Browse. Redirecting you to your dashboard…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="upload-page upload-page--design">
      <div className="upload-page-inner">
        <div className="upload-layout">
          <section
            className={`upload-main-card page-enter ${isVisible ? "page-enter-visible" : "page-enter-hidden"}`}
            style={{ transitionDelay: "0ms" }}
          >
            <h1 className="upload-main-title">Upload Your Notes</h1>
            <p className="upload-main-subtitle">
              Add a PDF for moderation; credits are awarded after approval.
            </p>

            {step === 1 && (
              <div className="upload-step">
                <h2 className="upload-step-heading">Step 1: Choose PDF</h2>
                <div
                  className="upload-dragzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <label htmlFor="upload-file-input" className="upload-dragzone-label">
                    <input
                      id="upload-file-input"
                      type="file"
                      accept="application/pdf"
                      className="upload-dragzone-input"
                      onChange={(e) => {
                        const chosen = e.target.files?.[0] ?? null;
                        if (chosen) handleFileChange(chosen);
                      }}
                    />
                    <span className="upload-dragzone-icon" aria-hidden>📄</span>
                    <span className="upload-dragzone-text">
                      {file ? file.name : "Drag and drop your file here"}
                    </span>
                    <span className="upload-dragzone-browse">
                      {file ? "Choose a different PDF" : "or click to browse"}
                    </span>
                    <span className="upload-dragzone-hint">
                      {file ? "PDF selected and ready to upload" : "Supported format: PDF (Max 25MB)"}
                    </span>
                  </label>
                </div>
                <div className="upload-step-buttons-row">
                  {file && filePreviewUrl && (
                    <button
                      type="button"
                      className="upload-preview-btn"
                      onClick={() => setShowPreview(true)}
                    >
                      Preview PDF
                    </button>
                  )}
                  <button
                    type="button"
                    className="upload-step-continue btn-lift"
                    onClick={() => setStep(2)}
                    disabled={!file}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="upload-step">
                <h2 className="upload-step-heading">Step 2: Note details</h2>
                <div className="upload-fields">
                  <div className="upload-field">
                    <label className="upload-label">Department *</label>
                    <select
                      className="upload-input"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} - {d.name}
                        </option>
                      ))}
                    </select>
                    <p className="upload-request-course-label" style={{ marginTop: "6px" }}>
                      Don&apos;t see your department?{" "}
                      <button
                        type="button"
                        className="upload-request-course-link"
                        onClick={openDepartmentRequest}
                      >
                        Request a department
                      </button>
                    </p>
                  </div>
                  <div className="upload-field upload-field-class">
                    <label className="upload-label">Class *</label>
                    <div className="upload-class-wrap">
                      <input
                        type="text"
                        className="upload-input"
                        placeholder={
                          !department
                            ? "Select department first"
                            : classesLoading
                              ? "Loading…"
                              : "e.g. AGED, CSC 101, or 101"
                        }
                        value={classNumberInput}
                        onChange={(e) => {
                          setClassNumberInput(e.target.value);
                          setClassNotFoundError(null);
                          setIsClassListOpen(true);
                        }}
                        onFocus={() => setIsClassListOpen(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            setIsClassListOpen(false);
                            matchClassFromInput();
                          }, 200);
                        }}
                        disabled={!department}
                        autoComplete="off"
                        aria-invalid={!!classNotFoundError}
                        aria-describedby={classNotFoundError ? "class-error" : undefined}
                        aria-controls="class-results-list"
                      />
                      {isClassListOpen && classNumberInput.trim() && department && (
                        <div
                          id="class-results-list"
                          className="upload-class-results"
                          role="listbox"
                        >
                          <div className="course-request-row">
                            <button
                              type="button"
                              className="course-request-button"
                              onClick={openCourseRequest}
                            >
                              Request a new course
                            </button>
                          </div>
                          {matchingClasses.length === 0 ? (
                            <div className="upload-class-results-empty">
                              No classes match. Request a new course?
                            </div>
                          ) : (
                            matchingClasses.slice(0, 80).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={classId === c.id}
                                className="upload-class-result-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setClassId(c.id);
                                  setClassNumberInput((c.code ?? c.name) ?? "");
                                  setClassNotFoundError(null);
                                  setIsClassListOpen(false);
                                }}
                              >
                                <span className="upload-class-result-code">{c.code ?? c.name}</span>
                                {c.name && c.name !== (c.code ?? "") && (
                                  <span className="upload-class-result-name">{c.name}</span>
                                )}
                              </button>
                            ))
                          )}
                          {matchingClasses.length > 80 && (
                            <div className="upload-class-results-more">
                              Type more to narrow ({matchingClasses.length} matches)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {classNotFoundError && (
                      <p id="class-error" className="upload-field-error" role="alert">
                        {classNotFoundError}
                      </p>
                    )}
                    {classesError && !classNotFoundError && (
                      <p className="upload-field-error" role="alert">
                        {classesError}
                      </p>
                    )}
                  </div>
                  <div className="upload-field upload-request-course-row" role="region" aria-label="Request a new course">
                    <p className="upload-request-course-label">Can&apos;t find your class?</p>
                    <button
                      type="button"
                      className="upload-request-course-link"
                      onClick={openCourseRequest}
                    >
                      Request a new course
                    </button>
                  </div>
                  <div className="upload-field">
                    <label className="upload-label">Note title *</label>
                    <input
                      className="upload-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Midterm review sheet"
                      required
                    />
                  </div>
                  <div className="upload-field">
                    <label className="upload-label">Resource type *</label>
                    <select
                      className="upload-input"
                      value={resourceType}
                      onChange={(e) => setResourceType(e.target.value)}
                      required
                    >
                      <option value="">Select type</option>
                      {resourceTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="upload-step-actions">
                  <button type="button" className="upload-step-back" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="upload-step-continue btn-lift"
                    onClick={() => {
                      const id = matchClassFromInput() ?? classId;
                      if (!id || !department?.trim() || !title.trim() || !resourceType) return;
                      if (id.startsWith("placeholder:")) {
                        setClassNotFoundError(
                          "This course isn’t in the catalog yet. Request a new course (link below) to add it."
                        );
                        return;
                      }
                      setStep(3);
                    }}
                    disabled={!department || !title.trim() || !resourceType}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form className="upload-step" onSubmit={handleSubmit}>
                <h2 className="upload-step-heading">Step 3: Add a description</h2>
                <p className="upload-step-desc">
                  Add a short summary so other students know what this note covers.
                </p>
                <div className="upload-field">
                  <label className="upload-label">Description *</label>
                  <textarea
                    className="upload-input upload-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Covers chapters 1–3, key formulas and examples"
                    rows={4}
                    maxLength={2000}
                    required
                  />
                  <span className="upload-char-count">{description.length}/2000</span>
                </div>
                <div className="upload-field">
                  <label className="upload-label">Professor (optional)</label>
                  {!isAddingProfessor ? (
                    <>
                      <select
                        className="upload-input"
                        value={professor}
                        onChange={(e) => setProfessor(e.target.value)}
                      >
                        <option value="">Select professor</option>
                        {getFacultyByDepartment(department).map((f) => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                        {department && getFacultyByDepartment(department).length === 0 && (
                          <option disabled>No professors found for this department</option>
                        )}
                        <option value="__add__">+ Add new professor</option>
                      </select>
                      {professor === "__add__" && (
                        <button
                          type="button"
                          className="upload-field-hint"
                          onClick={() => {
                            setIsAddingProfessor(true);
                            setProfessor("");
                          }}
                          style={{ background: "none", border: "none", color: "var(--poly-sage)", cursor: "pointer", padding: 0, marginTop: "8px" }}
                        >
                          Click to add a new professor
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="upload-input"
                        placeholder="Enter professor name"
                        value={customProfessor}
                        onChange={(e) => setCustomProfessor(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          className="upload-step-back"
                          onClick={() => {
                            setIsAddingProfessor(false);
                            setCustomProfessor("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="upload-submit-btn"
                          onClick={() => {
                            if (customProfessor.trim()) {
                              setProfessor(customProfessor.trim());
                              setIsAddingProfessor(false);
                              setCustomProfessor("");
                            }
                          }}
                        >
                          Add Professor
                        </button>
                      </div>
                    </>
                  )}
                  <p className="upload-field-hint">Helps students find notes by professor</p>
                </div>
                {submitError && (
                  <p className="upload-alert upload-alert--error" role="alert">{submitError}</p>
                )}
                <div className="upload-step-actions">
                  <button type="button" className="upload-step-back" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <button type="submit" className="upload-submit-btn btn-lift">
                    Upload notes
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="upload-sidecard upload-sidecard--credits" aria-label="Credits info">
            <h3 className="upload-sidecard-title">Credits (after approval)</h3>
            <div className="upload-credits-list">
              <div className="upload-credits-item">
                <span className="upload-credits-icon upload-credits-icon--upload" aria-hidden>↑</span>
                <div>
                  <h4 className="upload-credits-item-title">Upload rewards</h4>
                  <p className="upload-credits-item-desc">
                    Earn credits after approval. Lecture Notes and Study Guides earn 3 credits, while Class Overviews earn 5.
                  </p>
                </div>
              </div>
              <div className="upload-credits-item">
                <span className="upload-credits-icon upload-credits-icon--download" aria-hidden>↓</span>
                <div>
                  <h4 className="upload-credits-item-title">Downloads</h4>
                  <p className="upload-credits-item-desc">3 credits per download from others.</p>
                </div>
              </div>
              <div className="upload-credits-item">
                <span className="upload-credits-icon upload-credits-icon--quality" aria-hidden>★</span>
                <div>
                  <h4 className="upload-credits-item-title">Quality Bonus</h4>
                  <p className="upload-credits-item-desc">
                    Clear titles and descriptions help other students decide what to download.
                  </p>
                </div>
              </div>
            </div>
            <p className="upload-sidecard-tip">
              Upload useful notes to keep the catalog valuable for everyone.
            </p>
            <div className="upload-balance-box">
              <span className="upload-balance-label">Your Current Balance</span>
              <span className="upload-balance-value">{credits != null ? `${credits} Credits` : "—"}</span>
            </div>
          </aside>
        </div>
      </div>

      {showPreview && filePreviewUrl && (
        <div className="upload-preview-modal" onClick={() => setShowPreview(false)}>
          <div className="upload-preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="upload-preview-modal-header">
              <h3 className="upload-preview-modal-title">{file?.name ?? "PDF Preview"}</h3>
              <button
                type="button"
                className="upload-preview-modal-close"
                onClick={() => setShowPreview(false)}
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <div className="upload-preview-modal-body">
              <Document
                file={filePreviewUrl}
                onLoadSuccess={({ numPages }) => {
                  setNumPages(numPages);
                  setPageNumber(1);
                }}
                loading={<div className="upload-preview-loading">Loading PDF…</div>}
                error={<div className="upload-preview-error">Failed to load PDF</div>}
              >
                <Page
                  pageNumber={pageNumber}
                  width={Math.min(800, typeof window !== "undefined" ? window.innerWidth - 100 : 800)}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                />
              </Document>
              {numPages != null && numPages > 1 && (
                <div className="upload-preview-controls">
                  <button
                    type="button"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    className="upload-preview-nav-button"
                  >
                    Previous
                  </button>
                  <span className="upload-preview-page-info">Page {pageNumber} of {numPages}</span>
                  <button
                    type="button"
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                    className="upload-preview-nav-button"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
    </main>
  );
}
