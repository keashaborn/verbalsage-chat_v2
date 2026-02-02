import Link from "next/link";

export default function VerbalDesign() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Verbal Behavior · Design</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Define transcript/import templates and analysis targets.
      </div>

      <div className="mt-6 grid gap-3">
        <Link href="/developer/forms" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Forms Builder</div>
          <div className="mt-1 text-xs text-muted-foreground">Create templates for verbal data capture (v0).</div>
        </Link>

        <Link href="/collect?domain=verbal" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Record transcripts / imports (placeholder).</div>
        </Link>

        <Link href="/lifeswitch/verbal/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">SSLG graphs.</div>
        </Link>
      </div>
    </div>
  );
}
