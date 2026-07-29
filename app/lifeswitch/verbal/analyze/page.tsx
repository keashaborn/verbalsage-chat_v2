import SSLGPanel from "@/components/sslg/SSLGPanel";

export default function VerbalAnalyze() {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="text-lg font-semibold">Verbal Behavior · Analyze</div>
      <div className="mt-1 text-sm text-muted-foreground">Single-subject line graphs.</div>
      <div className="mt-6">
        <SSLGPanel embedded />
      </div>
    </div>
  );
}
