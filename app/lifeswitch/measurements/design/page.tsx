export default function MeasurementsMethodsPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 pb-28">
      <h1 className="text-xl font-semibold">Measurements · Methods</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Measurement protocols, directions, and consistency rules.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border p-4">
          <div className="text-sm font-semibold">Weight</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Weigh under consistent conditions. Best default: morning, after bathroom, before food or drink.
          </p>
        </section>

        <section className="rounded-xl border p-4">
          <div className="text-sm font-semibold">Tape measurements</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the same tape, posture, landmarks, and tension. Keep the tape flat and snug without compressing tissue.
          </p>
        </section>

        <section className="rounded-xl border p-4">
          <div className="text-sm font-semibold">Skinfolds / calipers</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the same sites each time. Take 2–3 readings per site and use the average or median. Track trends more than single absolute readings.
          </p>
        </section>

        <section className="rounded-xl border p-4">
          <div className="text-sm font-semibold">Body scans</div>
          <p className="mt-2 text-sm text-muted-foreground">
            DEXA, InBody, BodPod, hydrostatic weighing, and 3D scans report different metrics. Use the same method over time when possible.
          </p>
        </section>
      </div>
    </div>
  );
}
