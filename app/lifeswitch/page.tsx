import Link from "next/link";

export const dynamic = "force-dynamic";

function Card({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border p-4 hover:bg-gray-50 dark:hover:bg-white/5"
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-80">{desc}</div>
      <div className="mt-3 text-xs opacity-60">{href}</div>
    </Link>
  );
}

export default function LifeSwitchHubPage() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">LifeSwitch</h1>
        <div className="mt-2 text-sm opacity-80">
          Training and nutrition tools (templates, sessions, and progress).
        </div>
      </div>

      <div className="grid gap-3">
        <Card
          title="Nutrition"
          desc="Approved foods library search, meal plans, daily logging."
          href="/lifeswitch/nutrition"
        />
        <Card
          title="Training"
          desc="Workout templates, session logging, volume/progression views."
          href="/lifeswitch/training"
        />
        <Card
          title="Measurements"
          desc="Weight, DEXA, tape/circumference, calipers, photos."
          href="/lifeswitch/measurements"
        />
      </div>

      <div className="mt-6 text-xs opacity-60">
        Note: Training/Measurements pages will be enabled as their schemas land.
      </div>
    </div>
  );
}
