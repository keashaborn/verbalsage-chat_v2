import { NextRequest, NextResponse } from "next/server";
import {
  classifySiteRequest,
  resolveSiteHost,
  SITE_HEADER,
} from "@/lib/siteBrand";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com https://shvuircoviuuijthoqji.supabase.co wss://shvuircoviuuijthoqji.supabase.co",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src https://challenges.cloudflare.com",
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
  const vary = response.headers.get("Vary");
  if (
    !vary?.split(",").some((value) => value.trim().toLowerCase() === "host")
  ) {
    response.headers.set("Vary", vary ? `${vary}, Host` : "Host");
  }
  return response;
}

export default function proxy(req: NextRequest) {
  const host = resolveSiteHost(req.headers.get("host"));
  if (!host.recognized) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "unrecognized_host" },
        { status: 421, headers: { "cache-control": "no-store" } },
      ),
    );
  }

  if (!host.local && host.hostname !== host.canonicalHostname) {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.hostname = host.canonicalHostname;
    canonicalUrl.port = "";
    return withSecurityHeaders(NextResponse.redirect(canonicalUrl, 308));
  }

  const disposition = classifySiteRequest(
    host.siteId,
    req.nextUrl.pathname,
    req.method,
  );
  if (disposition === "not-found") {
    const isApi = req.nextUrl.pathname.startsWith("/api/");
    return withSecurityHeaders(
      isApi
        ? NextResponse.json(
            { error: "not_found" },
            { status: 404, headers: { "cache-control": "no-store" } },
          )
        : new NextResponse("Not Found", {
            status: 404,
            headers: {
              "cache-control": "no-store",
              "content-type": "text/plain; charset=utf-8",
            },
          }),
    );
  }

  if (disposition === "redirect-to-lifeswitch") {
    const lifeSwitchUrl = req.nextUrl.clone();
    lifeSwitchUrl.protocol = "https:";
    lifeSwitchUrl.hostname = "lifeswitch.com";
    lifeSwitchUrl.port = "";
    return withSecurityHeaders(NextResponse.redirect(lifeSwitchUrl, 308));
  }

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

  // The site identity is derived only from the allowlisted Host value above.
  // Overwrite any client-supplied value before server components see it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(SITE_HEADER, host.siteId);
  const nextResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return withSecurityHeaders(nextResponse);
}

// Skip static assets for perf.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
