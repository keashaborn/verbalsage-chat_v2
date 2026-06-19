# LifeSwitch Architecture Contract

## 1. System Definition

LifeSwitch is a deterministic behavioral event compiler.

It converts user intent into structured, analyzable behavioral events:

user intent
  -> reusable structure or active plan context
  -> capture execution
  -> normalized atomic records
  -> backend truth ledger
  -> read-only analytics
  -> later AI-accessible behavioral context

The UI is an interface over this model. UI labels, routes, and components may change freely. The system contract is the execution model and truth layer.

LifeSwitch domains should share the same conceptual shell whenever possible:

Library -> Plan -> Capture -> Log -> Analyze

Each domain gives those layers domain-specific meaning.

---

## 2. Global LifeSwitch Layer Model

### Library

Library defines reusable objects.

Library does not execute behavior.

Library does not log truth.

Examples:

- Nutrition: Foods and Meals
- Training: Exercises and Workouts
- Behavior: behavior definitions, measurement systems, intervention templates
- Verbal Behavior: verbal classes, coding rules, interaction sources

### Plan

Plan defines the current strategy.

Plan is not the event ledger.

Plan is not the raw capture surface.

Examples:

- Nutrition: cut, bulk, maintenance, recomp, macro targets, body-composition targets
- Training: program structure, split, phase, progression strategy, deloads
- Behavior: intervention plan, phase changes, reinforcement strategy
- Verbal Behavior: target repertoire, exposure strategy, interaction goals

### Capture

Capture is the execution surface.

Capture is where real-world behavior is converted into structured records.

Different domains may have different capture semantics:

- Nutrition capture can write intake rows immediately.
- Training capture may require an active session before final session logging.
- Behavior capture may record fast discrete events or interval data.
- Verbal Behavior capture may ingest external interaction data for later coding.

### Log

Log is the truth viewer.

Log reads from the domain ledger.

Log may allow carefully controlled edits or deletes to existing truth records.

Log does not define reusable structures.

Log does not plan future behavior.

### Analyze

Analyze is read-only projection.

Analyze renders trends from logged truth data.

Analyze should be domain-specific, even if it reuses shared graphing primitives.

---

## 3. Nutrition Model

Nutrition uses:

Library -> Plan -> Capture -> Log -> Analyze

### Nutrition Library

Nutrition Library contains reusable nutrition objects:

- saved foods imported from USDA/catalog
- user-owned MyFood entities
- reusable Meals built from saved foods
- default grams for foods
- default grams for meal items
- serving presets when useful

Nutrition Library does not log intake.

Nutrition Library does not define macro goals.

Nutrition Library does not execute meals.

### Nutrition Plan

Nutrition Plan defines macro and body-composition strategy.

It should support:

- cut
- bulk
- maintenance
- recomp
- recovery phase

A nutrition plan may contain:

- name
- phase
- target kcal
- target protein
- target carbs
- target fat
- start date
- optional end date
- target body weight
- target body fat percentage
- relevant measurements
- active/inactive state

Nutrition Plan does not contain foods by default.

Nutrition Plan does not define Meals by default.

Food and Meal construction belongs in Library.

Plan targets can later be shown in Capture, Log, and Analyze.

### Nutrition Capture

Nutrition Capture is direct intake execution.

It supports:

1. Individual Foods
   - select one saved food
   - use saved default grams or enter grams
   - log one atomic nutrition entry

2. Meals
   - select one reusable Meal from Library
   - expand Meal into editable food rows
   - optionally adjust grams
   - log one row or log all rows
   - every row becomes an atomic nutrition entry

Nutrition Capture may display rows grouped as meals, but grouping is UI scaffolding only.

Nutrition Capture writes through the nutrition log-entry API only.

### Nutrition Log

Nutrition Log is the intake truth ledger.

It reads from nutrition_entry.

It shows:

- daily intake
- calendar view
- entry history
- daily macro totals

Log edits should be explicit and clear.

If grams are changed, the UI should show either a Save action or a visible saved confirmation.

### Nutrition Analyze

Nutrition Analyze should replace generic SSLG/developer graph UI with nutrition-specific trend views.

It should support metrics such as:

- kcal
- protein
- carbs
- fat
- body weight
- body fat percentage
- waist or other measurements

Analyze should eventually compare actuals against active Plan targets.

---

## 4. Training Model

Training uses:

Library -> Plan -> Capture -> Log -> Analyze

### Training Library

Training Library contains reusable training objects:

- My Exercises imported from a global exercise catalog
- user-created exercises when catalog entries are missing
- Workouts built from My Exercises

Training Library / Exercises is equivalent to Nutrition Library / Foods.

Training Library / Workouts is equivalent to Nutrition Library / Meals.

A Workout template may contain:

- name
- ordered exercises
- default sets
- default reps
- default load guidance
- optional rest guidance
- notes

Training Library does not log completed training.

### Training Plan

Training Plan defines program strategy.

It should support:

- current goal
- weekly split
- program phase
- training frequency
- progression model
- deload logic
- block structure

Examples:

- four-day hypertrophy split
- push / pull / legs
- upper / lower
- strength block
- hypertrophy block
- deload week
- return-to-training phase

Workout templates belong in Library, not Plan.

Plan may reference workouts later, but Plan is primarily the program strategy layer.

### Training Capture

Training Capture executes today's workout.

Training capture differs from Nutrition capture.

Nutrition can write immediately. Training usually needs an active session.

Expected flow:

workout template
  -> today's active workout session
  -> editable exercises and sets
  -> log sets during workout
  -> add or remove exercises if needed
  -> adjust weight, reps, sets
  -> finish session
  -> completed session appears in Training Log

Training Capture should preserve structured data needed for later AI and analytics:

- exercise_id
- workout_id when applicable
- session_id
- date
- exercise order
- set number
- weight
- reps
- optional RPE or difficulty later
- notes

### Training Log

Training Log is the completed session ledger.

It should show:

- calendar view
- session list
- exercises performed
- sets
- reps
- weight
- volume
- session details

The current calendar/session feed is directionally correct.

It needs click-through session detail later.

### Training Analyze

Training Analyze should replace generic SSLG/developer graph UI with training-specific progression views.

It should support:

- exercise progression
- top set weight
- estimated 1RM
- total volume by exercise
- weekly volume by muscle group
- sets per muscle group
- session frequency
- PR tracking

---

## 5. Behavior Model

Behavior is a later domain.

It should use the same shell:

Library -> Plan -> Capture -> Log -> Analyze

Expected mapping:

- Library: behavior definitions, measurement systems, intervention templates
- Plan: behavior-change plan and intervention phase
- Capture: quick tracking interface
- Log: behavior event ledger
- Analyze: single-subject behavior graphs

AI should help operationally define target behaviors, define measurement systems, and interpret trends.

---

## 6. Verbal Behavior Model

Verbal Behavior is a later domain.

It should use the same shell:

Library -> Plan -> Capture -> Log -> Analyze

Expected mapping:

- Library: verbal classes, coding rules, source definitions
- Plan: target verbal repertoire or exposure strategy
- Capture: imported social/media interaction data
- Log: coded verbal events
- Analyze: verbal behavior change over time

Future goal:

The system should help identify which interactions or environments are changing verbal behavior patterns.

---

## 7. Data and Truth Invariants

These rules must not be violated.

- Domain truth lives in backend ledgers, not local UI state.
- Owner identity comes from authenticated Supabase user context, not browser cookies.
- Library defines reusable structures but does not execute behavior.
- Plan defines strategy but does not become raw truth.
- Capture is the execution surface.
- Log is the truth viewer.
- Analyze is read-only.
- UI grouping does not imply truth grouping unless the backend model explicitly defines that grouping.
- AI assistance should read structured data; it should not require unstructured screen scraping.

Nutrition-specific invariants:

- ALL nutrition intake writes go through /log/entry.
- nutrition_entry is the nutrition intake truth ledger.
- NO draft buffer is required for nutrition.
- NO meal object is logged as nutrition truth.
- Meals expand into atomic food rows.

Training-specific invariants:

- Training may use an active session object.
- Completed sets should remain atomic structured records.
- Completed sessions should be reconstructable from set/exercise records.
- Workout templates are not completed workouts.

---

## 8. Current Route Intent

Route structure may change, but the intended domain mapping is:

Nutrition:

/lifeswitch/nutrition/library
  -> Foods + Meals

/lifeswitch/nutrition/plan
  -> macro goals, cut/bulk/maintenance strategy, body-composition targets

/lifeswitch/nutrition/capture
  -> food and meal logging

/lifeswitch/nutrition/log
  -> intake ledger

/lifeswitch/nutrition/analyze
  -> nutrition and body-composition trends

Training:

/lifeswitch/training/library
  -> Exercises + Workouts

/lifeswitch/training/plan
  -> training program strategy

/lifeswitch/training/capture
  -> active workout execution

/lifeswitch/training/log
  -> completed session ledger

/lifeswitch/training/analyze
  -> strength, volume, progression trends

Current legacy routes may still exist during transition.

---

## 9. Immediate Implementation Direction

Near-term focus remains Nutrition first.

Priority order:

1. Keep this architecture contract current.
2. Clean up Nutrition Library / Meals UI.
3. Add delete whole Meal.
4. Clarify Food editor default grams vs serving presets.
5. Fix Nutrition Log grams-edit UX with explicit Save or visible saved state.
6. Redefine Nutrition Plan as macro/body-composition strategy.
7. Replace Nutrition Analyze SSLG UI with nutrition-specific trend selector.
8. Then use the Nutrition pattern to build Training Library / Workouts.
9. Then build Training Capture as active workout session execution.
10. Then build Training Analyze as progression analytics.

Do not mix unrelated branding/proxy/icon changes into LifeSwitch commits.
