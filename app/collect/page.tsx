export default function CollectPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="text-xl font-semibold">Collect</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Data collection workspace (stub). This will become the program-driven, ultra-minimal capture UI.
        </div>

        <div className="mt-6 rounded-xl border p-4 text-sm text-muted-foreground">
          Next: program selector → render the appropriate capture UI (count button, timer, workout entry, etc.).
        </div>
      </div>
    </div>
  );
}
