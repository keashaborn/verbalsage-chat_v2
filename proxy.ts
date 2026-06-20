import { NextRequest, NextResponse } from "next/server";

export default function proxy(req: NextRequest) {
  // Some stale clients/scanners send Next Server Action invocations.
  // Avoid Next logging "Failed to find Server Action" and any instability by dropping them here.
  if (req.headers.get("next-action")) {
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  return NextResponse.next();
}

// Skip static assets for perf.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
