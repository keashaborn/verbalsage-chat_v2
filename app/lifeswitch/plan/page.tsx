import Link from "next/link";

function SectionCard({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </div>
      <div className="mt-1 text-lg font-semibold">{title}</div>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function LifeSwitchPlanPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:p-6">
      <div className="rounded-2xl border bg-background p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          LifeSwitch
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Integrated Plan</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          One current intervention plan for body composition, nutrition, training,
          conditioning, daily activity, recovery, and outcome tracking.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a href="#body-state" className="rounded-full border px-3 py-1 hover:bg-muted/40">Body State</a>
          <a href="#nutrition-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Nutrition</a>
          <a href="#training-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Training</a>
          <a href="#conditioning-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Conditioning</a>
          <a href="#activity-recovery" className="rounded-full border px-3 py-1 hover:bg-muted/40">Activity / Recovery</a>
          <a href="#plan-notes" className="rounded-full border px-3 py-1 hover:bg-muted/40">Notes</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard id="body-state" eyebrow="Dependent variables" title="Current Body State">
          <div className="grid gap-2">
            <div>Weight, height, waist, body-fat estimate, and body-composition method.</div>
            <div>Future inputs: calipers, body scan, DEXA/InBody/3D scan, measurements, progress photos.</div>
          </div>
        </SectionCard>

        <SectionCard id="nutrition-targets" eyebrow="Nutrition prescription" title="Nutrition Targets">
          <div className="grid gap-2">
            <div>Calories, protein, carbohydrates, fat, meal structure, and phase.</div>
            <div className="text-xs">
              Related pages:{" "}
              <Link href="/lifeswitch/nutrition/meals" className="underline">Meals</Link>
              {" · "}
              <Link href="/lifeswitch/nutrition/meal-plans" className="underline">Meal Plans</Link>
              {" · "}
              <Link href="/lifeswitch/nutrition/capture" className="underline">Nutrition Capture</Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard id="training-targets" eyebrow="Strength prescription" title="Strength Training Targets">
          <div className="grid gap-2">
            <div>Workout frequency, split, strength emphasis, weak points, and recovery constraints.</div>
            <div className="text-xs">
              Related pages:{" "}
              <Link href="/lifeswitch/training/workouts" className="underline">Strength Workouts</Link>
              {" · "}
              <Link href="/lifeswitch/training/capture" className="underline">Training Capture</Link>
              {" · "}
              <Link href="/lifeswitch/training/calendar" className="underline">Training Log</Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard id="conditioning-targets" eyebrow="Cardio / conditioning" title="Conditioning and Cardio Targets">
          <div className="grid gap-2">
            <div>Cardio frequency, preferred mode, target duration, conditioning goals, and intensity target.</div>
            <div>Detailed treadmill, running, battle-rope, sled, bike, and interval templates will plug in later.</div>
          </div>
        </SectionCard>

        <SectionCard id="activity-recovery" eyebrow="Context variables" title="Daily Activity and Recovery">
          <div className="grid gap-2">
            <div>Steps, sleep, active calories, resting heart rate, HRV, zone minutes, soreness, and fatigue.</div>
            <div>Wearable integrations can feed this section later without changing the plan architecture.</div>
          </div>
        </SectionCard>

        <SectionCard id="plan-notes" eyebrow="Clinical / coaching frame" title="Plan Notes and Weekly Focus">
          <div className="grid gap-2">
            <div>What is the current goal? What are we changing? What are we watching this week?</div>
            <div>This is the bridge from plan → capture/log → analysis.</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
