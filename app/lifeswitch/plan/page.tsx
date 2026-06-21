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

function PlaceholderRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-muted/40 py-2 last:border-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="max-w-[65%] text-right text-sm">{value}</div>
    </div>
  );
}

export default function LifeSwitchPlanPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 pb-24 md:p-6">
      <div className="rounded-2xl border bg-background p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          LifeSwitch
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Physique Plan</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          One integrated plan for body composition, nutrition, strength training,
          conditioning, daily activity, recovery, monitoring, and weekly adjustment.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a href="#current-phase" className="rounded-full border px-3 py-1 hover:bg-muted/40">Phase</a>
          <a href="#body-state" className="rounded-full border px-3 py-1 hover:bg-muted/40">Body State</a>
          <a href="#nutrition-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Nutrition</a>
          <a href="#training-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Training</a>
          <a href="#conditioning-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Conditioning</a>
          <a href="#recovery-targets" className="rounded-full border px-3 py-1 hover:bg-muted/40">Recovery</a>
          <a href="#monitoring-rules" className="rounded-full border px-3 py-1 hover:bg-muted/40">Adjustments</a>
          <a href="#coach-notes" className="rounded-full border px-3 py-1 hover:bg-muted/40">Notes</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <SectionCard id="current-phase" eyebrow="Current intervention" title="Current Phase">
            <div className="grid gap-1">
              <PlaceholderRow label="Phase" value="Cut / Maintenance / Lean gain / Recomp" />
              <PlaceholderRow label="Primary goal" value="Body-composition outcome and performance priority" />
              <PlaceholderRow label="Start / review dates" value="Plan start date and next check-in" />
              <PlaceholderRow label="Weekly focus" value="The main change being tested this week" />
            </div>
          </SectionCard>

          <SectionCard id="nutrition-targets" eyebrow="Nutrition prescription" title="Nutrition Targets">
            <div className="grid gap-1">
              <PlaceholderRow label="Calories" value="Daily target or range" />
              <PlaceholderRow label="Protein" value="Daily grams and minimum threshold" />
              <PlaceholderRow label="Carbs / Fat" value="Macro ranges or flexible targets" />
              <PlaceholderRow label="Meal structure" value="Meal timing, meal count, repeat meals, pre/post-workout notes" />
              <PlaceholderRow label="Adherence target" value="What counts as compliant enough this week" />
              <div className="pt-2 text-xs">
                Related:{" "}
                <Link href="/lifeswitch/nutrition/meals" className="underline">Meals</Link>
                {" · "}
                <Link href="/lifeswitch/nutrition/meal-plans" className="underline">Meal Plans</Link>
                {" · "}
                <Link href="/lifeswitch/nutrition/capture" className="underline">Nutrition Capture</Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="training-targets" eyebrow="Strength prescription" title="Strength Training Targets">
            <div className="grid gap-1">
              <PlaceholderRow label="Split" value="Current weekly split and training days" />
              <PlaceholderRow label="Frequency" value="Workouts per week and expected duration" />
              <PlaceholderRow label="Priority areas" value="Weak points, priority lifts, muscles, or movement patterns" />
              <PlaceholderRow label="Progression rule" value="How load, reps, sets, or effort should change" />
              <PlaceholderRow label="Recovery constraints" value="Pain, surgery limits, fatigue, soreness, deload triggers" />
              <div className="pt-2 text-xs">
                Related:{" "}
                <Link href="/lifeswitch/training/workouts" className="underline">Strength Workouts</Link>
                {" · "}
                <Link href="/lifeswitch/training/capture" className="underline">Training Capture</Link>
                {" · "}
                <Link href="/lifeswitch/training/calendar" className="underline">Training Log</Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="conditioning-targets" eyebrow="Cardio / conditioning" title="Conditioning and Daily Activity Targets">
            <div className="grid gap-1">
              <PlaceholderRow label="Cardio target" value="None / optional / sessions per week / minutes per week" />
              <PlaceholderRow label="Preferred mode" value="Incline walk, treadmill, bike, intervals, ropes, sled, outdoor walk/run" />
              <PlaceholderRow label="Intensity" value="Zone 2, intervals, RPE, heart-rate target, or simple duration target" />
              <PlaceholderRow label="Steps / NEAT" value="Daily or weekly step target and general movement goal" />
              <PlaceholderRow label="Wearables" value="Future source for steps, calories, heart rate, HRV, sleep, zone minutes" />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard id="body-state" eyebrow="Dependent variables" title="Current Body State">
            <div className="grid gap-1">
              <PlaceholderRow label="Weight" value="Current body weight and trend" />
              <PlaceholderRow label="Measurements" value="Waist, chest, arms, thighs, hips, calves" />
              <PlaceholderRow label="Body composition" value="Estimate method and confidence" />
              <PlaceholderRow label="Calipers" value="Site measurements and formula later" />
              <PlaceholderRow label="Body scan" value="DEXA / InBody / 3D scan placeholder" />
            </div>
          </SectionCard>

          <SectionCard id="recovery-targets" eyebrow="Recovery prescription" title="Sleep and Recovery">
            <div className="grid gap-1">
              <PlaceholderRow label="Sleep target" value="Hours, consistency, wakeups, and quality" />
              <PlaceholderRow label="Rest days" value="Planned rest or low-stress activity days" />
              <PlaceholderRow label="Mobility" value="Flexibility, stretching, rehab, or movement-prep goal" />
              <PlaceholderRow label="Fatigue watch" value="Soreness, joint pain, motivation, performance drop" />
            </div>
          </SectionCard>

          <SectionCard id="monitoring-rules" eyebrow="Adjustment logic" title="Monitoring and Adjustment Rules">
            <div className="grid gap-2">
              <div>
                Define what changes the plan: weight trend, waist change, training
                performance, adherence, hunger, sleep, fatigue, and recovery.
              </div>
              <div>
                This becomes the bridge from plan → capture/log → analysis.
              </div>
            </div>
          </SectionCard>

          <SectionCard id="coach-notes" eyebrow="Weekly frame" title="Coach Notes">
            <div className="grid gap-2">
              <div>What is the plan trying to accomplish this week?</div>
              <div>What are the risks?</div>
              <div>What should be adjusted next if the trend is wrong?</div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
