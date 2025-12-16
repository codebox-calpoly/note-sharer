// app/test-upload/page.tsx
"use client";

import { useState } from "react";

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [accessToken, setAccessToken] = useState(
    process.env.NEXT_PUBLIC_TEST_ACCESS_TOKEN ?? "",
  );
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setResult("No file selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", classId);
    formData.append("title", title);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
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
      payload = { error: "Response was not valid JSON", details: String(error) };
    }

    setResult(`${res.status}: ${JSON.stringify(payload)}`);
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Test Upload</h1>

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
          <label className="block text-sm mb-1">Class ID</label>
          <input
            className="border px-2 py-1"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Note title</label>
          <input
            className="border px-2 py-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Access Token (Bearer)</label>
          <input
            className="border px-2 py-1 w-full"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Paste a user access token"
          />
        </div>

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
