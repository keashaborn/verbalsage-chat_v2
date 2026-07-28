import { NextRequest, NextResponse } from "next/server";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://shvuircoviuuijthoqji.supabase.co wss://shvuircoviuuijthoqji.supabase.co",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  ["Content-Security-Policy", CONTENT_SECURITY_POLICY],
  ["Strict-Transport-Security", "max-age=31536000"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
  ],
  ["Cross-Origin-Resource-Policy", "same-origin"],
] as const;

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  return response;
}

export default function proxy(req: NextRequest) {
  // Some stale clients/scanners send Next Server Action invocations.
  // Avoid Next logging "Failed to find Server Action" and any instability by dropping them here.
  if (req.headers.get("next-action")) {
    return withSecurityHeaders(
      new NextResponse(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      }),
    );
  }
  return withSecurityHeaders(NextResponse.next());
}

// Skip static assets for perf.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
