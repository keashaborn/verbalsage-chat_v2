import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const workoutsPage = readFileSync(
  join(root, "components/lifeswitch/training/WorkoutsPage.tsx"),
  "utf8",
);
const browseRoute = readFileSync(
  join(root, "app/api/catalog/exercises/browse/route.ts"),
  "utf8",
);

test("workout picker exposes three distinct discovery paths", () => {
  assert.match(workoutsPage, /\["browse", "Browse"\]/);
  assert.match(workoutsPage, /\["search", "Search equipment"\]/);
  assert.match(workoutsPage, /\["mine", "My exercises"\]/);
  assert.match(workoutsPage, /Show exercise library/);
  assert.match(workoutsPage, /Hide exercise library/);
});

test("browse mode loads generic families and exposes exact variants", () => {
  assert.match(workoutsPage, /\/api\/catalog\/exercises\/browse/);
  assert.match(workoutsPage, /family\.variants\.map/);
  assert.match(workoutsPage, /variant\.exercise_id/);
  assert.match(workoutsPage, /displayMovementGroup/);
  assert.match(workoutsPage, /exercise_family/);
});

test("equipment search remains separate from saved exercises", () => {
  assert.match(workoutsPage, /Hammer Strength chest press, barbell bench/);
  assert.match(workoutsPage, /Search equipment and variations/);
  assert.match(workoutsPage, /Exercises you have saved or created previously/);
  assert.doesNotMatch(workoutsPage, /catalog hits=/);
});

test("frontend browse proxy forwards only to the read-only browse endpoint", () => {
  assert.match(
    browseRoute,
    /new URL\(`\$\{BRAINS_URL\}\/catalog\/exercises\/browse`\)/,
  );
  assert.match(browseRoute, /method: "GET"/);
  assert.doesNotMatch(browseRoute, /method: "POST"/);
});

test("adding an exercise preserves the existing template and personal-library flow", () => {
  assert.match(workoutsPage, /upsertMyExercise/);
  assert.match(workoutsPage, /addExerciseToSelected/);
  assert.match(workoutsPage, /saved it to My exercises/);
  assert.match(
    workoutsPage,
    /Your existing workout and logged sessions are not\s+changed by browsing/,
  );
});
