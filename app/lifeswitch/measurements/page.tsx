import Link from "next/link";

export default function MeasurementsHome() {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-lg font-semibold">Measurements</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Review body-state history, capture measurements, standardize methods, and analyze trends.
        </div>
      </div>

      <div className="grid gap-3">
        <Link href="/lifeswitch/measurements/log" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Log</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Review weight, tape, skinfold, scan, and body-composition history.
          </div>
        </Link>

        <Link href="/lifeswitch/measurements/design" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Methods</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Measurement protocols, landmarks, consistency rules, and body-composition methods.
          </div>
        </Link>

        <Link href="/lifeswitch/measurements/capture" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Capture</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Log weight, tape measurements, skinfolds, or body-scan results.
          </div>
        </Link>

        <Link href="/lifeswitch/plan#body-state" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Plan</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Current body state, targets, monitoring rules, and check-in cadence.
          </div>
        </Link>

        <Link href="/lifeswitch/measurements/analyze" className="rounded-xl border p-4 hover:bg-muted/30">
          <div className="text-sm font-semibold">Analyze</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Body-state snapshot, estimated fat mass, lean mass, and trend readiness.
          </div>
        </Link>
      </div>
    </div>
  );
}
