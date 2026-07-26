const SUPABASE_VERIFY_PATH = "/auth/v1/verify";
const ACCESS_INVITE_PATH = "/auth/accept-invite";

function parseHttpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function validateAccessInviteConfirmationUrl(
  rawConfirmationUrl: string | null,
  configuredSupabaseUrl: string,
  applicationOrigin: string,
): string | null {
  if (!rawConfirmationUrl) return null;

  const confirmation = parseHttpsUrl(rawConfirmationUrl);
  const supabase = parseHttpsUrl(configuredSupabaseUrl);
  const application = parseHttpsUrl(applicationOrigin);
  if (!confirmation || !supabase || !application) return null;

  if (
    confirmation.origin !== supabase.origin ||
    confirmation.pathname !== SUPABASE_VERIFY_PATH ||
    confirmation.hash
  ) {
    return null;
  }
  if (
    confirmation.searchParams.get("type") !== "invite" ||
    !confirmation.searchParams.get("token")
  ) {
    return null;
  }

  const redirectValue = confirmation.searchParams.get("redirect_to");
  if (!redirectValue) return null;
  const redirect = parseHttpsUrl(redirectValue);
  if (
    !redirect ||
    redirect.origin !== application.origin ||
    redirect.pathname !== ACCESS_INVITE_PATH ||
    redirect.search ||
    redirect.hash
  ) {
    return null;
  }

  return confirmation.toString();
}
