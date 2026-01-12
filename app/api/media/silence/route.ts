export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const p = path.join(process.cwd(), "public", "silence.mp3");
  const buf = await readFile(p);

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=0",
    },
  });
}
