export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const p = path.join(process.cwd(), "public", "awake.mp4");
  const buf = await readFile(p);

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=0",
    },
  });
}
