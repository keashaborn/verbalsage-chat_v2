import Link from "next/link";
import {
  segmentTabClassName,
  segmentTabListClassName,
} from "@/components/lifeswitch/SegmentTabs";

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
      className={`mt-4 ${segmentTabListClassName} grid-cols-2`}
    >
      {modes.map((mode) => {
        const active = mode.id === selected;
        const className = segmentTabClassName(active);

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
