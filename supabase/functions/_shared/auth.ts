import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthenticatedRequestUser {
  userId: string;
  email: string | null;
  fullName: string | null;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackNameFromEmail(email: string | null) {
  if (!email) {
    return null;
  }

  const localPart = email.split("@")[0]?.trim();
  return localPart || null;
}

export async function requireAuthenticatedUser(req: Request): Promise<AuthenticatedRequestUser> {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    const error = new Error("Missing authorization header");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    const error = new Error("Supabase auth environment is not configured");
    (error as Error & { status?: number }).status = 500;
    throw error;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !data.user) {
    const error = new Error("Authenticated user could not be resolved");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const user = data.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const metadataFullName =
    normalizeText(user.user_metadata?.full_name)
    || normalizeText(user.user_metadata?.name);
  const profileFullName = normalizeText(profile?.full_name);
  const email = normalizeText(user.email) || normalizeText(profile?.email) || null;

  return {
    userId: user.id,
    email,
    fullName: metadataFullName || profileFullName || fallbackNameFromEmail(email),
  };
}
