export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETIRED_SEARCH_ROUTE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Content-Type": "text/plain; charset=utf-8",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-VS-Search-Authority": "server_search_authority_v1",
  "X-VS-Search-Route-Status": "retired",
} as const;

export async function POST(): Promise<Response> {
  return new Response("Direct search route retired; use /api/chat.", {
    status: 410,
    headers: RETIRED_SEARCH_ROUTE_HEADERS,
  });
}
