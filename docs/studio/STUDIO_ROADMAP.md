## Collect is Source of Truth (Entry Stream)

### Principles
- All measurements must enter the system as immutable events (manual Collect or import normalized into the same event shape).
- Graphing and analytics are pure projections; they do not create or mutate measurements.
- Fixes are overlays: void/error + correction. No destructive deletes in normal operation.

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
