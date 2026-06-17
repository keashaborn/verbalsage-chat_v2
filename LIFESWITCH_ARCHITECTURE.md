# LifeSwitch Architecture (Canonical)

## Core Primitives

### 1. Food
Atomic nutrition entity (MyFood / catalog food)

### 2. Pattern (MealBlueprint)
Reusable structure:
- name
- list of food items
- default grams

### 3. Event (nutrition_entry)
Atomic logged intake:
- my_food_id OR meal_id
- qty_g
- day

---

## Page Responsibilities

### Capture
- Execution engine
- Pattern expansion
- Atomic logging ONLY
- NO batch state

### Foods
- Manage MyFood entities
- Import from USDA/catalog
- Override system (alias + grams)

### Meals
- Pattern builder (MealBlueprint editor)
- NOT used for direct logging

### Log
- Immutable truth ledger
- Aggregation + analytics
- Calendar view

### Analyze
- Single-metric time series only
- Protein / kcal / macros trends

---

## System Rules

- NO draft system exists
- NO batch submission allowed
- ALL writes go through /log/entry
- Patterns are optional acceleration layer only
- UI grouping ≠ data grouping

---

## Backend Truth Layer

- nutrition_entry = source of truth
- meal_plan = pattern storage (future sync)
- meal_item = legacy compatibility only

