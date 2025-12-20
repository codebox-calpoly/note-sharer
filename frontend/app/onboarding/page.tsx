"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { generateUniqueNickname } from "@/lib/nicknames";
import "./onboarding.css";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace("/auth");
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_complete, display_name")
        .eq("id", userId)
        .single();

      if (profileError) {
        setError("Could not load profile. Please try signing in again.");
        setLoading(false);
        return;
      }

      if (profile?.onboarding_complete) {
        router.replace("/dashboard");
      } else {
        setDisplayName(profile?.display_name ?? null);
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const shuffleNickname = async () => {
    setShuffling(true);
    setError(null);
    try {
      const nickname = await generateUniqueNickname(supabase);
      setDisplayName(nickname);
    } catch (generationError) {
      // eslint-disable-next-line no-console
      console.error("Failed to generate nickname", generationError);
      setError("Unable to generate a nickname. Please try again.");
    } finally {
      setShuffling(false);
    }
  };

  const complete = async () => {
    setSaving(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user.id;
    if (!userId) {
      router.replace("/auth");
      return;
    }

    let nameToSave = displayName;
    if (!nameToSave) {
      try {
        nameToSave = await generateUniqueNickname(supabase);
        setDisplayName(nameToSave);
      } catch (generationError) {
        // eslint-disable-next-line no-console
        console.error("Failed to generate nickname", generationError);
        setError("Unable to generate a nickname. Please try again.");
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding_complete: true, display_name: nameToSave })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
  };

  if (loading) {
    return (
      <main className="onboarding-page">
        <section className="onboarding-card">
          <p className="onboarding-status">Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <p className="onboarding-kicker">Welcome</p>
        <h1 className="onboarding-title">Finish onboarding</h1>
        <div className="onboarding-nickname">
          <div className="onboarding-nickname-row">
            <span className="onboarding-nickname-chip">
              {displayName ?? "Tap shuffle to generate"}
            </span>
            <button
              type="button"
              className="onboarding-secondary"
              onClick={shuffleNickname}
              disabled={shuffling || saving}
            >
              {shuffling ? "Shuffling..." : "Shuffle nickname"}
            </button>
          </div>
          <p className="onboarding-body">
            This name will show up to other users. You can always change it later in settings.
          </p>
        </div>

        <div className="onboarding-actions">
          <label className="onboarding-terms">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>
              I agree to the{" "}
              <a
                href="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms & Conditions
              </a>
            </span>
          </label>

          <button
            className="onboarding-button"
            onClick={complete}
            disabled={saving || !acceptedTerms}
          >
            {saving ? "Saving..." : "Continue to dashboard"}
          </button>

          {error ? <p className="onboarding-error">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
