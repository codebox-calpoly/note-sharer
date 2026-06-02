"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import "./auth.css";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/auth/callback";
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { session, error: sessionError } = await getSessionWithRecovery(supabase);
      if (sessionError) console.error("Failed to fetch session", sessionError);
      if (session) {
        router.replace(redirectTo.startsWith("/") ? redirectTo : "/auth/callback");
        return;
      }
      setChecking(false);
    };
    checkSession();
  }, [router, redirectTo]);

  const handleSendOtp = async () => {
    setMessage("");
    setError("");
    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@calpoly.edu")) {
      setError("Please enter your Cal Poly email address");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to send sign-in email.");
      } else {
        setAwaitingOtp(true);
        setMessage("Check your email for the one-time code.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async () => {
    setMessage("");
    setError("");
    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    const token = otp.trim();
    if (!token) {
      setError("Enter the one-time code from your email.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: token }),
      });
      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        session?: { access_token: string; refresh_token: string };
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Invalid or expired code.");
      } else if (data.session) {
        // Set the session in Supabase client
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        router.replace(redirectTo.startsWith("/") ? redirectTo : "/auth/callback");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  const content = checking ? (
    <p className="auth-loading">Checking your session…</p>
  ) : (
    <div className="auth-card">
      <h1 className="auth-title">Sign in or register</h1>
      <p className="auth-body">
        Enter your Cal Poly email to receive a one-time code. New users will automatically create an account after verification.
      </p>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!awaitingOtp) {
            void handleSendOtp();
          } else {
            void handleVerifyOtp();
          }
        }}
      >
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="username@calpoly.edu"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={awaitingOtp}
        />
        {awaitingOtp ? (
          <>
            <p className="auth-body">Enter the one-time code from your email.</p>
            <label className="auth-label" htmlFor="otp">
              One-time code
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              required
              placeholder="Enter the 6-digit code"
              className="auth-input"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
            <button
              type="submit"
              className="auth-button-primary"
              disabled={!email || submitting || !otp.trim()}
            >
              {submitting ? "Verifying..." : "Verify code"}
            </button>
            <button
              type="button"
              className="auth-button-secondary"
              onClick={() => {
                setAwaitingOtp(false);
                setOtp("");
                setMessage("");
                setError("");
              }}
            >
              Use a different email
            </button>
            <p className="auth-body">
              Use this if you entered the wrong email address the first time.
            </p>
          </>
        ) : null}
        {!awaitingOtp ? (
          <button
            type="submit"
            className="auth-button-primary"
            disabled={!email || submitting}
          >
            {submitting ? "Sending..." : "Send code"}
          </button>
        ) : null}
        {message ? <p className="auth-success">{message}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </form>
    </div>
  );

  return <main className="auth-page">{content}</main>;
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <p className="auth-loading">Loading…</p>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
