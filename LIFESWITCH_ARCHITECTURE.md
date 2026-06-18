# LifeSwitch Architecture Contract

## 1. System Definition

LifeSwitch is a deterministic behavioral event compiler.

It converts user intent into normalized atomic events:

user intent
  -> optional reusable pattern expansion
  -> normalized atomic rows
  -> backend write
  -> immutable event ledger
  -> read-only analytics

The UI is an interface over this model. UI labels, routes, and components may change freely. The system contract is the execution model and truth layer.

---

## 2. Nutrition Core Model

Nutrition has four conceptual layers:

Library -> Capture -> Log -> Analyze

### Library

Library is the reusable source layer.

It contains:

- saved foods imported from USDA/catalog
- user-owned MyFood entities
- reusable meal combos / meal blueprints
- default quantities for combo items
- aliases, serving defaults, and food-specific convenience metadata

Library does not log intake.

Library does not execute.

Library only defines reusable entities and reusable structures.

### Capture

Capture is the execution surface.

It supports two execution modes:

1. Individual Foods
   - select one saved food
   - enter grams
   - log one atomic nutrition entry

2. Meal Combos
   - select one reusable meal combo
   - expand combo into editable food rows
   - optionally adjust grams, remove rows, or add foods
   - log each row as an atomic nutrition entry

Capture may display rows grouped as meals, but grouping is UI scaffolding only.

Capture is the only place where nutrition intake execution occurs.

### Log

Log is the truth viewer.

It reads from nutrition_entry.

It shows atomic food entries, calendar views, daily totals, and entry history.

Log does not define foods.

Log does not define meal combos.

Log does not execute reusable patterns.

### Analyze

Analyze is read-only projection.

It renders simple trend views from logged truth data, such as:

- kcal over time
- protein over time
- carbs over time
- fat over time
- future bodyweight / measurement overlays

Analyze does not mutate nutrition data.

---

## 3. Data Primitives

### Food

Atomic nutrition entity.

Current implementation:

- my_food
- imported from USDA/catalog or created by user
- owned by Supabase user identity
- contains per-100g nutrition facts

### Meal Combo / MealBlueprint

Reusable meal structure.

Current implementation may use existing meal and meal_item tables.

A meal combo contains:

- name
- meal type
- ordered list of food items
- default grams or serving-based quantity per item

Meal combos are templates only.

They are not truth records.

### Capture Row

Ephemeral execution row created during Capture.

A capture row contains:

- my_food_id
- display label
- grams to log
- optional source combo context for UI display only

Capture rows are not persisted as drafts.

### Event

Atomic logged intake.

Current implementation:

- nutrition_entry

Required fields include:

- owner user identity
- day
- my_food_id
- qty_g

nutrition_entry is the source of truth.

---

## 4. Hard Invariants

These rules must not be violated.

- ALL nutrition intake writes go through /log/entry.
- nutrition_entry is the only nutrition intake truth ledger.
- NO draft buffer is allowed.
- NO batch commit object is allowed.
- NO meal object is logged as truth.
- Meal combos expand into atomic food rows.
- UI grouping does not imply data grouping.
- Library never executes.
- Log never executes.
- Analyze never mutates.
- Capture is the only execution surface.
- Owner identity comes from authenticated Supabase user context, not cookies.

---

## 5. Current Route Intent

The route structure may change, but the intended mapping is:

/lifeswitch/nutrition/library
  -> foods + meal combos

/lifeswitch/nutrition/capture
  -> individual food logging + meal combo execution

/lifeswitch/nutrition/log
  -> truth ledger

/lifeswitch/nutrition/analyze
  -> read-only trends

Current legacy routes may still exist during transition:

/lifeswitch/nutrition/design
/lifeswitch/nutrition/plan
/lifeswitch/nutrition/meals
/lifeswitch/nutrition/meal-plans

These are implementation details until the route cleanup pass.

---

## 6. Implementation Direction

Immediate nutrition rebuild direction:

1. Treat current FoodsPage as Library / Foods.
2. Treat current MealsPage as Library / Meal Combos.
3. Treat current NutritionCapturePage as the Capture execution surface.
4. Remove hardcoded Capture patterns.
5. Load meal combos from the existing meals API.
6. Allow Capture to switch between Individual Foods and Meal Combos.
7. Keep /log/entry as the only write sink.
8. Hide or remove Plan once Library covers foods + meal combos.

No new backend model is required until existing meal / meal_item semantics prove insufficient.
