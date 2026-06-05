"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { getSessionWithRecovery, supabase } from "@/lib/supabaseClient";
import { buildProfileInitials } from "@/lib/profile-display";
import { DesignNav } from "./DesignNav";

type CreditsPayload = {
  credits?: number;
  freeDownloads?: number;
};

type EnrollmentPayload = {
  enrollmentRequired?: boolean;
};

type ProfilePayload = {
  display_name: string | null;
  handle: string | null;
};

type ModAccessPayload = {
  allowed?: boolean;
};

const APP_PATHS = ["/dashboard", "/course", "/upload", "/leaderboard", "/profile", "/moderator"];

function getActiveNav(pathname: string) {
  if (pathname.startsWith("/upload")) return "upload" as const;
  if (pathname.startsWith("/leaderboard")) return "leaderboard" as const;
  if (pathname.startsWith("/moderator")) return "moderator" as const;
  if (pathname.startsWith("/profile")) return "profile" as const;
  return "browse" as const;
}

export function AuthenticatedAppChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [freeDownloads, setFreeDownloads] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [showModerator, setShowModerator] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isAppShellRoute = useMemo(
    () => APP_PATHS.some((prefix) => pathname.startsWith(prefix)),
    [pathname],
  );

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      const { session: currentSession } = await getSessionWithRecovery(supabase);
      if (!cancelled) {
        setSession(currentSession);
        setSessionLoaded(true);
      }
    };

    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAppShellRoute || !sessionLoaded || session) return;
    router.replace("/");
  }, [isAppShellRoute, router, session, sessionLoaded]);

  useEffect(() => {
    if (!isAppShellRoute || !session?.access_token) return;

    let cancelled = false;
    const authHeaders = {
      Authorization: `Bearer ${session.access_token}`,
    };

    const loadShellData = async () => {
      const [creditsRes, enrollmentRes, moderatorRes, profileRes] = await Promise.all([
        fetch("/api/credits", { headers: authHeaders }).catch(() => null),
        fetch("/api/me/enrollment", { headers: authHeaders }).catch(() => null),
        fetch("/api/mod/access", { headers: authHeaders }).catch(() => null),
        supabase
          .from("profiles")
          .select("display_name, handle")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (creditsRes?.ok) {
        const payload = (await creditsRes.json()) as CreditsPayload;
        setCredits(Number.isFinite(payload.credits) ? Number(payload.credits) : 0);
        setFreeDownloads(
          Number.isFinite(payload.freeDownloads) ? Number(payload.freeDownloads) : 0,
        );
      } else {
        setCredits(null);
        setFreeDownloads(null);
      }

      if (enrollmentRes?.ok) {
        const payload = (await enrollmentRes.json()) as EnrollmentPayload;
        if (
          payload.enrollmentRequired &&
          pathname !== "/onboarding"
        ) {
          router.replace("/onboarding?mode=course-refresh");
          return;
        }
      }

      if (moderatorRes?.ok) {
        const payload = (await moderatorRes.json()) as ModAccessPayload;
        setShowModerator(Boolean(payload.allowed));
      } else {
        setShowModerator(false);
      }

      const profileData = profileRes.data as ProfilePayload | null;
      setDisplayName(profileData?.display_name ?? null);
      setHandle(profileData?.handle ?? null);
    };

    void loadShellData();

    return () => {
      cancelled = true;
    };
  }, [isAppShellRoute, session?.access_token, session?.user.id, pathname, router]);

  if (!isAppShellRoute) {
    return null;
  }

  const initials =
    session != null ? buildProfileInitials(displayName, handle) : "";

  const rightSlot =
    session != null ? (
      <>
        <span className="app-shell-pill">Credits: {credits ?? "\u2014"}</span>
        {(freeDownloads ?? 0) > 0 ? (
          <span className="app-shell-pill">Free downloads: {freeDownloads}</span>
        ) : null}
        <Link
          href="/profile"
          className="app-shell-profile-link"
          aria-label="Open profile"
        >
          {initials}
        </Link>
      </>
    ) : (
      <Link
        href="/auth"
        className="design-nav-link font-medium text-lg py-2 px-3 rounded-lg text-[#666666] hover:text-[#6dbe8b] [data-theme=dark]:text-gray-300"
      >
        Sign in
      </Link>
    );

  return (
    <DesignNav
      active={getActiveNav(pathname)}
      rightSlot={rightSlot}
      showModerator={showModerator}
    />
  );
}
