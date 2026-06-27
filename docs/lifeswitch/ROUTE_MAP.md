# LifeSwitch Route Map

## Primary Product Surface

Current primary LifeSwitch modules:

- Training
- Nutrition
- Measurements
- Unified Plan
- People / sharing
- Helper context

Behavior and Verbal routes are retained as future/hidden modules but are not part of the current primary product surface.

## Canonical Routes

### LifeSwitch Shell

- `/lifeswitch`
  - redirects to `/lifeswitch/training/calendar`
- `/lifeswitch/plan`
  - unified LifeSwitch plan

### Training

Canonical daily surface:

- `/lifeswitch/training/calendar`

Canonical module pages:

- `/lifeswitch/training/calendar`
- `/lifeswitch/training/capture`
- `/lifeswitch/training/capture/conditioning`
- `/lifeswitch/training/design/workouts`
- `/lifeswitch/training/design/conditioning`
- `/lifeswitch/training/design/exercises`
- `/lifeswitch/training/analyze`
- `/lifeswitch/training/session`

Aliases / compatibility routes:

- `/lifeswitch/training/log`
  - redirects to `/lifeswitch/training/calendar`
- `/lifeswitch/training/design`
  - redirects to `/lifeswitch/training/design/workouts`
- `/lifeswitch/training/plan`
  - redirects to `/lifeswitch/plan#training-targets`
- `/lifeswitch/training/workouts`
  - redirects to `/lifeswitch/training/design/workouts`
- `/lifeswitch/training/exercises`
  - redirects to `/lifeswitch/training/design/exercises`

Visible navigation should prefer the canonical `/lifeswitch/training/design/*` routes.

### Nutrition

Canonical module pages:

- `/lifeswitch/nutrition/log`
- `/lifeswitch/nutrition/capture`
- `/lifeswitch/nutrition/design/foods`
- `/lifeswitch/nutrition/design/meals`
- `/lifeswitch/nutrition/analyze`
- `/lifeswitch/nutrition/foods`
- `/lifeswitch/nutrition/meals`
- `/lifeswitch/nutrition/meal-plans`

Aliases / compatibility routes:

- `/lifeswitch/nutrition/design`
  - redirects to `/lifeswitch/nutrition/design/foods`
- `/lifeswitch/nutrition/plan`
  - redirects to `/lifeswitch/plan#nutrition-targets`

Nutrition capture should remain item-by-item and should not redirect after each food log.

### Measurements

Canonical module pages:

- `/lifeswitch/measurements/log`
- `/lifeswitch/measurements/capture`
- `/lifeswitch/measurements/design`
- `/lifeswitch/measurements/analyze`

Aliases / compatibility routes:

- `/lifeswitch/measurements`
  - module landing page with Log, Methods, Capture, Plan, and Analyze cards
- `/lifeswitch/measurements/plan`
  - redirects to `/lifeswitch/plan#body-state`

### People / Sharing

Canonical module pages:

- `/lifeswitch/people`
- `/lifeswitch/people/messages`
- `/lifeswitch/people/helping`
- `/invite/lifeswitch/[token]`

People/sharing is part of the current support surface, but should remain secondary to Training, Nutrition, Measurements, and Plan.

## Future / Hidden Modules

These routes may remain in the codebase but should not appear in primary navigation until reactivated:

- `/lifeswitch/behavior/*`
- `/lifeswitch/verbal/*`

Current rule:

- Do not remove these routes without a separate migration decision.
- Do not present them in primary LifeSwitch navigation.
- Do not wire them into the helper as active product scope unless explicitly reactivated.

## Navigation Rules

- Use canonical routes for visible links.
- Keep aliases only for compatibility and old links.
- Do not place UI pages under `app/api`.
- Bottom mode navigation should only activate for active modules:
  - training
  - nutrition
  - measurements
- Workspace menu should show only current product surfaces:
  - Plan
  - Nutrition
  - Training
  - Measurements
  - People

## Future Capability Alignment

Later module-level capabilities may map to these route groups:

- `lifeswitch.training.view`
- `lifeswitch.training.edit`
- `lifeswitch.nutrition.view`
- `lifeswitch.nutrition.edit`
- `lifeswitch.measurements.view`
- `lifeswitch.measurements.edit`
- `lifeswitch.people.use`
- `lifeswitch.sharing.manage`
- `lifeswitch.helper.use`
- `lifeswitch.analysis.use`
- `lifeswitch.behavior.view`
- `lifeswitch.behavior.edit`
- `lifeswitch.verbal.view`
- `lifeswitch.verbal.edit`
