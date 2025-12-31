// app/upload/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import "./upload.css";

export default function UploadPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [classId, setClassId] = useState<string | "all">("all");
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);

  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Authentications
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log("UploadPage supabase.auth.getSession error:", error);
      }
      if (!data?.session) {
        // not logged in
        router.replace("/auth");
        return;
      }

      setIsAuthenticated(true);
    })();
  }, [router]);

  //recycled
  useEffect(() => {
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setClassesError("Not authenticated");
      }
      setAccessToken(data.session?.access_token ?? null);
      setTokenLoaded(true);
    };
    loadSession();
  }, []);

  const selectedClassLabel = (() => {
    if (!classId) return "--Select Class--";
    const c = classes.find((cl) => cl.id === classId);
    if (!c) return "--Select Class--";
    return c.code ? `${c.name} (${c.code})` : c.name;
  })();

  const handleSelectClass = (id: string | "all") => {
    console.log("handleSelectClass:", id);
    setClassId(id);
    setIsClassDropdownOpen(false);
    setClassSearch("");
  };

  const filteredClasses = useMemo(() => {
    const term = classSearch.trim().toLowerCase();
    if (!term) return classes;
    return classes.filter((c) => {
      const label = (c.name + (c.code ? ` ${c.code}` : "")).toLowerCase();
      return label.includes(term);
    });
  }, [classes, classSearch]);

  //

  useEffect(() => {
    if (!tokenLoaded) return;
    if (!accessToken) {
      setClassesError("Not authenticated");
      return;
    }

    const fetchClasses = async () => {
      try {
        const res = await fetch("/api/classes", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) {
          const errorPayload =
            (await res.json().catch(async () => ({
              error: await res.text().catch(() => ""),
            }))) || {};
          setClassesError(errorPayload.error || "Failed to load classes");
          setClasses([]);
          return;
        }
        const data = await res.json();
        setClasses(data.classes || []);
      } catch (err) {
        setClassesError("Failed to load classes");
        setClasses([]);
      }
    };

    fetchClasses();
  }, [accessToken, tokenLoaded]);

  useEffect(() => {
    if (!isSuccess) return;
    const timer = window.setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isSuccess, router]);

  // File Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setResult(null);
    setIsUploading(true);
    setIsSuccess(false);

    if (!file) {
      setSubmitError("No file selected");
      setIsUploading(false);
      return;
    }

    if (!classId || classId === "all") {
      setSubmitError("Please select a class before uploading.");
      setIsUploading(false);
      return;
    }

    if (!accessToken) {
      setSubmitError("Missing access token. Please re-authenticate.");
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", classId);
    formData.append("title", title);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let payload: unknown;
      try {
        if (res.headers.get("content-type")?.includes("application/json")) {
          payload = await res.json();
        } else {
          const text = await res.text();
          payload = text ? { message: text } : null;
        }
      } catch (error) {
        payload = {
          error: "Response was not valid JSON",
          details: String(error),
        };
      }

      if (!res.ok) {
        const message =
          typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: string }).error)
            : "Upload failed. Please try again.";
        setSubmitError(message);
        setIsUploading(false);
        return;
      }

      setResult(`${res.status}: ${JSON.stringify(payload)}`);
      setIsSuccess(true);
    } catch (error) {
      setSubmitError("Upload failed. Please check your connection and retry.");
    } finally {
      setIsUploading(false);
    }

    //json for deubgging purposes
    //setResult(`${res.status}: ${JSON.stringify(payload)}`);
  };

  if (isUploading) {
    return (
      <main className="upload-status-screen">
        <div className="upload-status-card">
          <div className="upload-spinner" aria-hidden="true" />
          <h1 className="upload-status-title">Uploading your notes…</h1>
          <p className="upload-status-subtitle">
            Hang tight while we save your file.
          </p>
        </div>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="upload-status-screen">
        <div className="upload-status-card">
          <div className="upload-success-check" aria-hidden="true">
            ✓
          </div>
          <h1 className="upload-status-title">Upload successful</h1>
          <p className="upload-status-subtitle">
            Redirecting you to your dashboard…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="m-4 border rounded bg-blue shadow-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">Upload Notes</h1>

      {!isAuthenticated && (
        <p className="text-sm text-red-600">
          Checking authentication… If you are not redirected, refresh the
          page.
        </p>
      )}

      {classesError && (
        <p className="text-sm text-red-600">{classesError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">File (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          {/* Class Selection */}
          <section className="flex flex-wrap gap-4 items-center">
            <div className="relative min-w-[220px]">
              <label className="block text-sm mb-1">Class</label>

              <div
                className="border rounded px-2 py-1 flex items-center justify-between cursor-pointer bg-white"
                onClick={() => setIsClassDropdownOpen((open) => !open)}
              >
                <span className="text-sm truncate text-gray-800">
                  {selectedClassLabel}
                </span>
                <span className="ml-2 text-xs text-gray-700">▾</span>
              </div>

              {isClassDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full border rounded bg-white shadow-md max-h-64 overflow-y-auto">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      className="w-full border px-2 py-1 text-sm text-gray-800 placeholder:text-gray-500"
                      placeholder="Search classes…"
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {filteredClasses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
                      onClick={() => handleSelectClass(c.id)}
                    >
                      {c.name}
                      {c.code ? ` (${c.code})` : ""}
                    </button>
                  ))}

                  {filteredClasses.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-700">
                      No classes match “{classSearch}”
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div>
          <label className="block text-sm mb-1">Note title</label>
          <input
            className="border px-2 py-1 w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* remove in production, kept for testing purposes */}

        {/*<div>
          <label className="block text-sm mb-1">Access Token (Bearer)</label>
          <input
            className="border px-2 py-1 w-full"
            value={accessToken ? accessToken : ""}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Paste a user access token"
          />
        </div>*/}

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        <button type="submit" className="border px-3 py-1">
          Upload
        </button>
      </form>

      {result && (
        <pre className="mt-4 text-xs whitespace-pre-wrap border p-2">
          {result}
        </pre>
      )}
    </main>
  );
}
