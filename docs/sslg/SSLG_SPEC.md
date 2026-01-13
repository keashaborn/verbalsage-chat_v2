# SSLG Specification

## Purpose
SSLG is a single-subject line graph workspace that:
1) renders charts from immutable, append-only measurement data, and
2) provides controlled, auditable overlays (phase design, annotations, corrections) without mutating historical entries.

SSLG must function as a reusable “graph tool” that can connect to multiple data sources. The first data source is the existing Forms API.

## Core principles

### Immutable measurements
Measurement entries are append-only. Historical rows are never rewritten. If a value is wrong, the system records a correction that references the prior entry and describes why.

### Overlay edits, not mutation
Edits occur as new overlay records:
- corrections: “void/replace entry X with entry Y” + reason
- phase changes: “on date D, phase changes to B” + notes
- annotations: “context note at date D” + notes

The chart computes an effective series by applying overlays to the immutable base series.

### Separation of concerns
- Data layer: measurement entries + overlay entries (phases/corrections/annotations)
- Graph layer: view configuration (axes, scaling, labels, rendering options)
- UI layer: workspace that reads data + config, and emits overlay/config writes

The UI should not store canonical measurements. It should orchestrate reads and emit controlled writes.

## Terminology

### Owner
Authenticated user (Supabase user id). Owner is derived from session; never typed manually.

### Client
A subject under an owner. Current identifier is `subject_id` string. Near-term: subject dropdown populated from distinct subject_ids. Later: a Client Demographics entity with a stable UUID and metadata (name, contact, physiology).

### Program
A tracked target/metric for a client. Near-term: a Program is a published template version (Forms template/version). Later: a Program Design entity that generates templates, plus program instances assigned to clients.

### Measurement entry
A single recorded observation for a (owner, client, program_version). Stored via `/api/forms/entries`.

### Correction entry
An overlay record that targets a program version and references an old entry id. Stored as a specific “Correction template” entry.

### Phase entry
An overlay record that targets a program version and marks a phase label at a date. Stored as a specific “Phase template” entry.

### Graph config
A saved view definition for a program: axes, label text, scaling, tick spacing, trial/date mode, render options. Stored separately from measurement entries. Versioned.

## Current implementation (as of now)
Code locations:
- `components/sslg/MiniLineChart.tsx` — renderer
- `components/sslg/SSLGPanel.tsx` — workspace logic (fetch entries, phases, corrections; compute effective series)
- `components/sslg/SSLGModal.tsx` — modal wrapper
- `components/sslg/SSLGModalLauncher.tsx` — button that opens modal
- `app/developer/sslg/page.tsx` — developer page that hosts SSLGPanel
- `app/sslg/page.tsx` (or redirect) — public route alias

Existing APIs consumed:
- GET `/api/forms/templates/{owner_user_id}`
- GET `/api/forms/versions/{version_id}`
- GET `/api/forms/entries/list?owner_user_id=...&subject_id=...&template_version_id=...`
- POST `/api/forms/entries` (used elsewhere, and will be used for overlays)

Auth:
- Owner id derived via Supabase browser session (preferred) or `/api/auth/whoami` (server cookie based). Client-side SSLG should use the same method as Forms for consistency.

## Product vision: SSLG as a graph workspace

### Primary workflow
1) Select Client
2) Select Program
3) Chart renders (blank state until data)
4) Controls panel allows:
   - axis labeling
   - scale bounds and tick spacing
   - x mode (trial vs date)
   - phase design and phase change points
   - annotations
   - correction actions with reason
5) Save Graph Config (versioned)
6) Optional: compare multiple programs over a time window

### UI layout (SSLG page)
Top:
- Client selector (dropdown)
- Program selector (dropdown)
- Load/Refresh

Middle:
- Single main graph (one program)

Bottom: “Graph Controls”
- Axes
  - X mode: date | trial
  - X label
  - Tick spacing controls
- Y settings
  - Y label
  - Unit
  - includeZero
  - min/max
  - tick interval
- Phases
  - add phase start (date, phase label, notes)
  - edit/remove phase overlay (writes new overlay record; does not delete history)
- Corrections
  - select an entry point; mark “void” or “replace with …”
  - require reason string
  - show audit trail
- Annotations
  - add note at date/trial
  - show timeline of annotations

### Manual data entry mode
Manual entry is allowed only as one of:
A) Create new measurement entries through the normal entry pipeline (recommended), or
B) Create “draft” measurements stored as a separate dataset (not canonical) until published.

Default path: entries are created elsewhere (forms). SSLG provides an optional “quick add entry” tool that creates a normal entry with reason/notes.

## Data invariants and audit rules

### Corrections
- Correction records reference:
  - target_template_version_id
  - old_entry_id
  - new_entry_id (optional; missing implies void)
  - reason (required)
- Effective series:
  - exclude voided entries
  - exclude replaced old entries
  - include replacement entries if present (replacement is a normal measurement entry)

### Phases
- Phase record fields:
  - target_template_version_id
  - date (or trial index)
  - phase label (A/B/etc)
  - notes
- Rendering:
  - show phase labels
  - optionally break line at phase changes

### Config versioning
- Graph configs are versioned and immutable once saved.
- Editing config creates a new config version.
- UI shows current config version + history.

## Planned pages and navigation (target structure)

Developer tools menu (near-term):
- Forms (template + entry plumbing)
- SSLG (graph workspace)
- Diagnostics (LLM probe suite)
- Inspector (prompt/debug)
- Memory cards

Later (non-developer navigation):
- Clients (demographics)
- Programs (program design)
- SSLG (graphs)
- Research design (phase plans, protocol, notes)
- Diagnostics (optional/admin)

## Build plan (milestones)

### M0 (done)
- SSLG page renders real series with phases/corrections overlays
- Program dropdown populated from templates
- Owner id derived from auth (not typed manually)

### M1: Remove raw IDs from UI
- Remove free-text template_version_id input
- Remove owner_user_id input entirely (owner derived only)
- Program selection only through dropdown (plus optional search)
Acceptance:
- No UUIDs exposed in the main UI surface

### M2: Client selector
- Replace subject text input with dropdown
- Populate dropdown from distinct `subject_id` values for owner (temporary)
- Persist selection in querystring for shareable links
Acceptance:
- User can select client without typing identifiers

### M3: Graph Controls (local state)
- Add controls panel for labels + scaling (does not require DB yet)
- Graph updates live based on controls
Acceptance:
- User can adjust axes/labels/ticks without touching database

### M4: Save/load Graph Config (DB)
- Implement Graph Config storage (new table or Forms-based template, decided below)
- Add “Save config”, “Load config”, “Config history”
Acceptance:
- Config persists and can be reverted by selecting prior versions

### M5: Overlay management UX
- UI to add phase starts with notes
- UI to add corrections with required reason
- UI to show audit trail for overlays
Acceptance:
- Overlay operations work end-to-end; effective series updates correctly

### M6: Manual entry tools
- Optional quick-entry pane that creates normal measurement entries (with notes)
- Optional draft dataset (separate from canonical) if needed
Acceptance:
- Manual data entry is possible without violating immutability

### M7: Multi-program compare view
- Select multiple programs
- Align by date; show stacked small multiples or overlay
- Filter by time window
Acceptance:
- Compare across behaviors during an interval

## Storage decision for Graph Config
Two acceptable options:

Option A (preferred long-term): dedicated tables
- `clients`
- `programs`
- `graph_configs` (+ versions)
- `graph_overlays` (annotations if not using Forms)

Option B (fast iteration): Forms-backed config templates
- store graph config as a Form template entry keyed by (owner, client, program_version)
- still versioned by entry history

Near-term choice: Option B is faster. Option A is cleaner. Pick based on how soon client/program pages ship.

## Open questions (to resolve early)
- Subject identity: keep string `subject_id` or introduce UUID client id now?
- Program identity: template version is adequate for now; do we need “program instance” per client?
- Axis control defaults: do we auto-scale by data or respect saved bounds?
- Trial axis semantics: how to derive trial number from entries (occurred_at order vs explicit trial field)?

