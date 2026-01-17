## Collect is Source of Truth (Entry Stream)

### Principles
- All measurements must enter the system as immutable events (manual Collect or import normalized into the same event shape).
- Graphing and analytics are pure projections; they do not create or mutate measurements.
- Fixes are overlays: void/error + correction. No destructive deletes in normal operation.

## Life Switch IA (Product Navigation)

Goal: separate system admin/developer tooling from the behavior-change product surface.

### Modules
- Admin: system operations (export, delete memories, diagnostics). Keep existing patterns.
- Developer: engineering-only diagnostics. Remove Life Switch surfaces from Developer navigation.
- Life Switch: behavior-change suite (define variables, capture events, graph, studio).

### Left-nav structure (v0)
- Core nav: Chat, Collect, History (as appropriate).
- Footer tiles: Life Switch | Admin
  - Life Switch opens a dedicated side panel / module area.

### Life Switch sections (v0)
- Capture: Collect (forms entry), Workout, Diet, “Why not?” (non-occurrence).
- Define: Operational definitions (variable library), measurement protocols (calipers, labs).
- Graph: SSLG first; later celeration + graph suite.
- Studio: template/program design, capture UX design, graph_spec_v0, template deletion/cleanup.

### Route mapping (keep nothing hidden)
- /developer/sslg -> /life-switch/graph/sslg (keep old route with “Moved” banner + link)
- /developer/forms -> /life-switch/studio/forms (same)
- Deletion UI lives under Life Switch → Studio; backend deletion is Brains /forms/templates/... with confirm=true.

### Entry Model v0 (minimum)
Required:
- entry_id, owner_user_id, subject_id
- program_id/template_version_id
- measure_key (variable/behavior)
- occurred_at, recorded_at
- value, unit/value_type
- contingency_tags[] (explicit; stored on each event)
- source/provenance (collect_ui/import, device/session id)

Overlays:
- Void: void_of_entry_id, reason, voided_at, voided_by
- Correction: correction_of_entry_id, replacement_fields, corrected_at, corrected_by

Graph projection defaults:
- use latest non-void value per original event chain
- optional toggle: include void/error-marked points

### Collect UX Guardrails (v0)
- Sticky header shows: Subject, Program/Variable, Active contingencies.
- Record action is unambiguous and prominent.
- Post-save “last event” card with: Undo / Edit / Mark error (all single-click).
- Subject/program switching requires explicit confirmation (lock/unlock).

## Workout Collect UX (Strength Training) v0

### Navigation / Subject model (single-user mode)
- Subject is implicit: always the logged-in user ("self"). No subject/client selector in UI.
- Entries still store subject_id for future multi-subject support; UI always uses the self subject_id.
- Future expansion path: enable additional subject_ids + subject picker + access controls (no schema migration required).

### Flow
1) Admin -> Collect (label may change to "Data entry"; route can stay /collect).
2) Choose Program (e.g., "Push Day").
3) Exercise Index for that program:
   - Ordered list of exercises (drag handle to reorder).
   - Each row shows: exercise name + last recorded set summary (e.g., 185x5) + sets completed today.
4) Tap an exercise -> Set Entry screen:
   - Fields: weight, reps, optional notes, optional tags (contingencies/context), optional RPE.
   - Prefill weight/reps from last set for that exercise; allow quick +/- adjustments.
   - Primary action: "Save set".
5) After save:
   - Show "Saved" card with Undo / Edit / Mark error (overlay semantics).
   - Start rest timer (default per exercise; configurable).
   - Return to Exercise Index (immediately or after a short confirmation).

### Data model (source-of-truth events)
- workout_session (optional grouping entity for a day): owner_user_id, subject_id, program_id, started_at, ended_at, notes.
- workout_set event (recommended as the canonical measurement):
  - owner_user_id, subject_id, program_id
  - measure_key = exercise_id (or exercise slug)
  - occurred_at, recorded_at
  - set_index (int), weight, reps, unit
  - tags[] (context/contingencies), notes
  - session_id (nullable; links to workout_session)
- Derived views (never source-of-truth): volume_load per exercise/session, e1RM estimates, celeration/week.

### Error handling / audit
- Undo / Mark error creates a Void overlay (void_of_entry_id).
- Edit creates a Correction overlay (correction_of_entry_id with replacement fields).
- Graphs and summaries default to "latest non-void" projection.

### Anti-mixing invariants (single-user)
- API queries MUST always filter on (owner_user_id, subject_id, template_version/program).
- In single-user mode, subject_id is always the self subject_id derived from the session.
- UI always renders current context: Program | Variable (subject omitted because it is always self).
