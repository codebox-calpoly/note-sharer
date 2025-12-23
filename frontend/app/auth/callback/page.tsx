"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { generateUniqueNickname } from "@/lib/nicknames";
import "./callback.css";

const makeHandleBase = (email: string | null, userId: string) => {
  const localPart = email?.split("@")[0] ?? "user";
  const cleaned = localPart.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const base = cleaned.length >= 3 ? cleaned : `user_${userId.slice(0, 6)}`;
  return base.slice(0, 24);
};

const createProfileWithDefaults = async (
  userId: string,
  email: string | null
) => {
  const baseHandle = makeHandleBase(email, userId);
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix =
      attempt === 0 ? "" : `_${Math.random().toString(36).slice(2, 6)}`;
    const handle = `${baseHandle}${suffix}`.slice(0, 32);
    let displayName: string | null = null;

    try {
      displayName = await generateUniqueNickname(supabase);
    } catch (generationError) {
      console.error("Failed to generate display name", generationError);
      displayName = null;
    }

    const { error, data } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        handle,
        campus_email: email,
        display_name: displayName,
        onboarding_complete: false,
      })
      .select("onboarding_complete")
      .single();

    if (!error) {
      return data;
    }

    lastError = { message: error.message, code: error.code };

    // If it's a unique violation (handle/email), retry with a new suffix.
    if (error.code !== "23505") {
      break;
    }
  }

  throw lastError ?? new Error("Failed to create profile");
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking your session...");

  useEffect(() => {
    const handleRedirect = async () => {
      setStatus("Validating session...");
      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        router.replace("/auth");
        return;
      }

      const userId = data.session.user.id;
      const userEmail = data.session.user.email ?? null;
      setStatus("Checking onboarding status...");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_complete, display_name")
        .eq("id", userId)
        .single();

      // If no profile exists, create a default one with onboarding incomplete.
      if (profileError) {
        const noRows = profileError?.code === "PGRST116";
        if (noRows) {
          try {
            setStatus("Creating your profile...");
            await createProfileWithDefaults(userId, userEmail);
            router.replace("/onboarding");
            return;
          } catch (creationError) {
            console.error("Failed to create profile", creationError);
            setStatus("We could not set up your profile. Please try again.");
            await supabase.auth.signOut();
            router.replace("/auth");
            return;
          }
        }
        console.error("Failed to fetch onboarding status", profileError);
        setStatus("We could not load your profile. Please sign in again.");
        await supabase.auth.signOut();
        router.replace("/auth");
        return;
      }

      // Backfill display_name if missing on existing profile.
      if (!profile.display_name) {
        try {
          const newDisplayName = await generateUniqueNickname(supabase);
          await supabase
            .from("profiles")
            .update({ display_name: newDisplayName })
            .eq("id", userId);
        } catch (generationError) {
          console.error("Failed to backfill display name", generationError);
        }
      }

      if (profile?.onboarding_complete) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <main className="callback-page">
      <p className="callback-status">{status}</p>
    </main>
  );
}
