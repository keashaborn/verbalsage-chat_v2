# LifeSwitch Product Architecture

## Current Product Scope

LifeSwitch is currently focused on:

- Training
- Nutrition
- Measurements
- Unified Plan
- People / sharing support
- LifeSwitch helper context

Behavior tracking and verbal/social-media analysis routes may remain in the codebase, but they are not part of the current primary product surface.

## Product Principle

Build LifeSwitch as one integrated platform with modular internal boundaries.

The user experience should feel unified:

- one LifeSwitch shell
- one plan
- one helper
- one identity/account model
- consistent navigation
- consistent capture/log/analyze patterns

The engineering model should remain modular:

- training module
- nutrition module
- measurements module
- people/sharing module
- helper/analysis module
- future behavior module
- future verbal module

## Future Monetization Readiness

Do not build pricing or billing assumptions into the product now.

Instead, preserve optional future access boundaries through capabilities and module structure.

Potential future capability families:

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

These capabilities may later map to tiers, roles, coach access, or clinical/team plans.

## UX Consistency Rules

### Training

Training capture is session-based.

Expected flow:

- capture workout
- finish session
- redirect to Training Log / Calendar

Canonical URL:

- `/lifeswitch/training/calendar`

The old `/lifeswitch/training/log` route may remain as an alias, but visible links should prefer the canonical calendar URL.

### Nutrition

Nutrition capture is item-by-item and often repeated several times in one sitting.

Expected flow:

- log food
- stay on Nutrition Capture
- show confirmation
- allow more food/meal entries

Do not redirect after each food log.

A future explicit "Done" action may redirect to Nutrition Log, but single food logging should not.

### Measurements

Measurements are snapshot-based.

Expected flow:

- capture measurement set
- review in Measurements Log
- analyze trends separately

## Engineering Standards

- No accidental UI pages inside `app/api`.
- Visible navigation should use canonical routes.
- Legacy aliases may exist, but should not be the primary linked surface.
- Hidden/future modules should remain out of primary navigation.
- Backend route enforcement is the security boundary.
- Frontend visibility is a convenience layer only.
- Shared/delegated LifeSwitch access must be enforced server-side, not only by query parameters.
