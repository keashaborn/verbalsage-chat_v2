import Link from "next/link";

export default function VerbalDesign() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Verbal Behavior · Design</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Define what to capture and how to analyze verbal output.
      </div>

      <div className="mt-6 grid gap-3">
        <Link href="/collect?domain=verbal" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Transcripts / imports (placeholder).</div>
        </Link>

        <Link href="/lifeswitch/verbal/plan" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Intervention plan (placeholder).</div>
        </Link>

        <Link href="/lifeswitch/verbal/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">SSLG graphs.</div>
        </Link>
      </div>
    </div>
  );
}
