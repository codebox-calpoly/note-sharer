import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabaseServerClient";

export const MODERATOR_ROLES = ["developer"] as const;

export type ModeratorRole = (typeof MODERATOR_ROLES)[number];

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  return authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.split(" ")[1]?.trim() ?? null
    : null;
}

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase service role environment variables are not configured.");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function requireModerator(req: Request) {
  const bearerToken = getBearerToken(req);
  if (!bearerToken) {
    return {
      ok: false as const,
      status: 401,
      error: "A bearer session token is required.",
    };
  }

  const supabase = await createServerClient(bearerToken);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "Not authenticated.",
    };
  }

  const adminClient = createServiceRoleClient();
  const { data: roles, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("profile_id", user.id)
    .in("role", [...MODERATOR_ROLES]);

  if (roleError) {
    return {
      ok: false as const,
      status: 500,
      error: roleError.message,
    };
  }

  const roleValues = (roles ?? []).map((row: { role: string }) => row.role);
  if (roleValues.length === 0) {
    return {
      ok: false as const,
      status: 403,
      error: "Developer role required.",
    };
  }

  return {
    ok: true as const,
    user,
    roles: roleValues,
    adminClient: adminClient as SupabaseClient,
  };
}

export async function readBlockedAt(adminClient: SupabaseClient, profileId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("blocked_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as { blocked_at: string | null } | null)?.blocked_at ?? null;
}
