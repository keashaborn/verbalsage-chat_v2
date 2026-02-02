import SSLGPanel from "@/components/sslg/SSLGPanel";

export default function TrainingAnalyzePage() {
  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="text-lg font-semibold">Training · Analyze</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Single-subject line graphs. Select a program/template to graph.
      </div>

      <div className="mt-6">
        <SSLGPanel embedded />
      </div>
    </div>
  );
}
