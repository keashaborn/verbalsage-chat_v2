export default function LifeSwitchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="text-xl font-semibold">LifeSwitch</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Behavior-change workspace (stub).
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <a className="rounded-xl border p-4 hover:bg-muted/40" href="/collect">
            <div className="text-sm font-semibold">Capture</div>
            <div className="mt-1 text-xs text-muted-foreground">Data capture workspace.</div>
          </a>

          <a className="rounded-xl border p-4 hover:bg-muted/40" href="/developer/sslg">
            <div className="text-sm font-semibold">SSLG</div>
            <div className="mt-1 text-xs text-muted-foreground">Single-subject line graph workspace.</div>
          </a>

          <a className="rounded-xl border p-4 hover:bg-muted/40" href="/developer/forms">
            <div className="text-sm font-semibold">Design</div>
            <div className="mt-1 text-xs text-muted-foreground">Program/template design workspace.</div>
          </a>
        </div>
      </div>
    </div>
  );
}
