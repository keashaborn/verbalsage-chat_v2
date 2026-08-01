import Link from "next/link";

type TrainingCaptureMode = "strength" | "conditioning";

const modes: Array<{
  id: TrainingCaptureMode;
  label: string;
  href: string;
}> = [
  {
    id: "strength",
    label: "Strength",
    href: "/lifeswitch/training/capture",
  },
  {
    id: "conditioning",
    label: "Conditioning",
    href: "/lifeswitch/training/capture/conditioning",
  },
];

export function TrainingCaptureModeSwitch({
  selected,
}: {
  selected: TrainingCaptureMode;
}) {
  return (
    <nav
      aria-label="Training capture type"
      className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border/60 bg-muted/10 text-sm"
    >
      {modes.map((mode) => {
        const active = mode.id === selected;
        const className = [
          "flex min-h-11 items-center justify-center px-3 text-center outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active
            ? "bg-muted/50 font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
        ].join(" ");

        return active ? (
          <span key={mode.id} aria-current="page" className={className}>
            {mode.label}
          </span>
        ) : (
          <Link key={mode.id} href={mode.href} className={className}>
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
