import { headers } from "next/headers";

// Decide whether cookies should be `secure` for *this request*.
// - HTTPS (x-forwarded-proto=https) => secure true
// - Port-forward / localhost over HTTP => secure false
export async function cookieSecure(): Promise<boolean> {
  const h = await headers();

  const proto = (h.get("x-forwarded-proto") || "").toLowerCase();
  if (proto) return proto === "https";

  const host = (h.get("host") || "").toLowerCase();
  if (host.includes("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0")) {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
