import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createClient = async (accessToken?: string | null) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for Supabase client.");
  }

  let token = accessToken ?? null;
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("sb-access-token")?.value ?? null;
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
