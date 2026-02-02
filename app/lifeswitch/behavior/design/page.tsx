import Link from "next/link";

export default function BehaviorDesign() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Behavior · Design</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Define measurement templates and intervention plans.
      </div>

      <div className="mt-6 grid gap-3">
        <Link href="/developer/forms" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Forms Builder</div>
          <div className="mt-1 text-xs text-muted-foreground">Create / edit data collection forms (v0).</div>
        </Link>

        <Link href="/lifeswitch/behavior/plan" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">Intervention plan (placeholder).</div>
        </Link>

        <Link href="/collect?domain=behavior" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">Record events using selected templates.</div>
        </Link>

        <Link href="/lifeswitch/behavior/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">SSLG graphs.</div>
        </Link>
      </div>
    </div>
  );
}
