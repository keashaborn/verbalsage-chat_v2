export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const text = String(body?.text ?? "").trim();
    const voice = String(body?.voice ?? "sage").trim();
    const model = String(body?.model ?? "gpt-4o-mini-tts").trim();
    const instructions = String(body?.instructions ?? "").trim();

    let speed = Number(body?.speed ?? 1.0);
    if (!Number.isFinite(speed)) speed = 1.0;
    speed = clamp(speed, 0.25, 4.0);

    if (!text) return new Response("Missing text", { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response("Server missing OPENAI_API_KEY", { status: 500 });

    const payload: any = {
      model,
      voice,
      input: text,
      response_format: "mp3",
      speed,
    };

    // Only gpt-4o-mini-tts supports "instructions"
    if (instructions && model === "gpt-4o-mini-tts") {
      payload.instructions = instructions;
    }

    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errTxt = await r.text().catch(() => "");
      return new Response(`TTS upstream error: HTTP ${r.status}\n${errTxt}`, { status: 502 });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return new Response(buf, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  } catch (e: any) {
    return new Response(`TTS route error: ${e?.message || String(e)}`, { status: 500 });
  }
}
