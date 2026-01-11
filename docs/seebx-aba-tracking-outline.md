```md
# Seebx (Verbal Sage Extension) — ABA Behavior Tracking Build Outline

## Glossary (canonical terms)
- Target / Program: the behavior or skill being tracked (ABA concept)
- Template: container for a target/program definition
- Template Version (`template_version_id`): immutable snapshot of schema + metadata for a target/program
- Entry: one observation/event record for a given subject + template_version_id
- Subject: the person whose behavior is being tracked (self, client_1, etc.)

## Glossary (canonical terms)
- Target / Program: the behavior or skill being tracked (ABA concept)
- Template: container for a target/program definition
- Template Version (`template_version_id`): immutable snapshot of schema + metadata for a target/program
- Entry: one observation/event record for a given subject + template_version_id
- Subject: the person whose behavior is being tracked (self, client_1, etc.)

## Glossary (canonical terms)
- Target / Program: the behavior or skill being tracked (ABA concept)
- Template: container for a target/program definition
- Template Version (`template_version_id`): immutable snapshot of schema + metadata for a target/program
- Entry: one observation/event record for a given subject + template_version_id
- Subject: the person whose behavior is being tracked (self, client_1, etc.)


## 0) Purpose and non-negotiables
- Build a low-friction ABA tracking system that supports real behavior change, not just record-keeping.
- Default to “person-in-context” (relations first): behavior is tracked with its functional context.
- Support both self-management and caregiver/clinician-assisted workflows.
- Privacy-first: user owns data; clear consent; minimal collection by default; exportable.

## Appendix A) Current implementation mapping (Forms engine → ABA tracking)

Today we have a generic Forms engine:

- Template: logical form/program container (immutable id)
- Template Version: immutable schema + metadata snapshot (`version_id`)
- Entry: one observation/event row tied to a `template_version_id`

### A.1 Entity mapping
- Behavior Target (program unit) = Template + active Template Version
- Measurement Plan = Template Version metadata:
  - `metadata.measurement` (preferred)
  - fallback: `metadata.program_spec_v0.measurement`
- Observation/Event Record = Entry:
  - `owner_user_id`: the account owner
  - `subject_id`: the tracked person (client_1, self, etc.)
  - `template_version_id`: which target/program this entry belongs to
  - `occurred_at`: server timestamp (UTC)
  - `data`: JSON payload (date/value/context/etc.)

### A.2 Program spec compiler (current authoring path)
We currently generate publish payloads by compiling `scripts/program_specs/*.json` via:
- `scripts/compile-program-spec.js` → `{ owner_user_id, name, json_schema, ui_schema, metadata }`
Then `POST /api/forms/publish` forwards to BRAINS `/forms/publish`.

This is the bridge until the “Target builder” UI exists.

### A.3 Phase change markers (current implementation)
We represent phase boundaries as Entries of a dedicated phase marker template version:
- `template_version_id = <PHASE_TEMPLATE_VERSION_ID>`
- `data = { date, phase, target_template_version_id, notes? }`

Graph rendering converts these to dashed phase-change lines.
Baseline start markers are typically suppressed; only phase transitions render.

Does this look like a thorough .md to describe where we are going with this?


## 1) Core user roles and permissions
- Learner / Client (self-tracking)
- Caregiver / Parent (tracks for another; can view/edit)
- Clinician / BCBA (program design, review, notes, approvals)
- Admin (org-level settings, billing, compliance)

Permissions matrix (must define):
- Who can create/edit targets
- Who can record events
- Who can view raw notes vs summarized analytics
- Who can export/delete data
- Consent/assent tracking for minors and dependent adults

## 2) Primary entities (data model)
### 2.1 Person / Profile
- Demographics (optional/minimal)
- Timezone, schedule preferences
- Communication preferences (prompts, reminders)
- Safety flags (if any), crisis resources links (non-clinical, informational)

### 2.2 Behavior Target (the “program unit”)
Required fields:
- Name (human-readable)
- Type: Increase / Decrease / Maintain
- Operational definition (what counts / what doesn’t)
- Measurement type (see 2.3)
- Context scope: where/when/with whom it applies
- Status: Active / Paused / Archived
- Priority and “active set” membership (limit active targets for low friction)

Optional fields:
- Function hypothesis (attention/escape/tangible/automatic/multiple/unknown)
- Replacement behavior(s) + operational definition
- Skill acquisition vs behavior reduction tag
- Plan notes (clinician-facing)

### 2.3 Measurement Plan
Support these measurement types:
- Frequency / Count
- Rate (count per time)
- Duration
- Latency
- Interval recording (partial/whole/momentary)
- ABC event-based recording (lightweight)
- Intensity rating (anchored scale)
- Task analysis / step completion
- Permanent product (photo/checkbox evidence; optional)

For each target define:
- Default measurement type
- Allowed measurement types (if multiple)
- Data validation rules (min/max, required fields)

### 2.4 Observation / Event Record
Minimum viable event record (fast entry):
- Target ID
- Timestamp (auto)
- Value (e.g., count=1, duration=30s, intensity=3)
- Optional quick tags (antecedent, setting, people, location)

Expanded event record (later enrichment):
- Antecedent(s) (select + free text)
- Setting events / MOs (sleep, hunger, illness, stress, transitions)
- Consequence(s) (what happened after)
- Perceived function (optional)
- Notes (private vs shareable)
- Media attachment (optional; strict permissions)

### 2.5 Context Taxonomy (relational tags)
- Locations (home/school/community/custom)
- People (roles, not names by default: parent/teacher/peer)
- Activities (homework, meal, transition, play)
- Demands (high/low; type)
- Sensory context (noise/crowd/light)
- Internal state tags (sleepy/anxious/pain) — optional, user-controlled

### 2.6 Reinforcers and Consequences Library
- Reinforcer menu (user-chosen, preference assessed)
- Reinforcement type: social/activity/tangible/sensory/token/other
- Cost/effort and availability constraints
- Schedules: FR/VR/FI/VI, thinning plan, bonus rules
- “What actually happened” logging (did reinforcement deliver? when?)

### 2.7 Intervention Plan (optional but important)
- Antecedent strategies
- Teaching procedures (prompting, fading, shaping)
- Differential reinforcement (DRA/DRI/DRO/DRL)
- Extinction notes (if used; caution)
- Crisis/safety plan link (if relevant; not a substitute for care)

### 2.8 Goals, Criteria, and Mastery
- Baseline summary
- Short-term criterion (e.g., 80% for 2 weeks)
- Generalization criteria (across settings/people)
- Maintenance schedule
- Auto-suggestions for criterion updates (clinician approves)

### 2.9 Sessions (for clinic/school use)
- Session start/end
- Staff present
- Setting
- Targets run
- IOA fields (see 7.4)

## 3) Key workflows (UX flows)
### 3.1 Onboarding
- Choose mode: Self / Caregiver / Clinician-led
- Select 1–3 initial targets (limit)
- Define measurement type + operational definition
- Choose reinforcers (quick preference check)
- Set reminder schedule (optional)

### 3.2 Daily capture (ultra-low friction)
- Home screen: “Active targets” with one-tap record
- Quick add: count +1, start/stop timer, intensity slider
- Optional context chips (tap to add)
- Offline-first capture; sync later

### 3.3 Nightly review (2–5 minutes)
- Timeline of events
- Add missing context/ABC notes
- Mark reinforcement delivered (yes/no; delay)
- Quick reflection prompt (optional)

### 3.4 Weekly review (clinician/caregiver)
- Graphs + trend summaries
- Pattern detection (time-of-day, setting, people)
- Update plan: add antecedent strategy, adjust reinforcement schedule
- Decide next “micro-experiment” (see 6.3)

### 3.5 Program editing and versioning
- Every target definition change is versioned
- Data remains linked to the version used at the time
- Change log: who changed what and why

### 3.6 Export / sharing
- Export CSV + PDF summary
- Share link with permissions + expiration
- Clinician report templates (baseline, progress, generalization)

## 4) UI components to build
- Active targets dashboard (fast record)
- Target builder (operational definition + measurement plan)
- Event timeline (edit/enrich)
- Context tag manager
- Reinforcer library + schedule builder
- Graphs and analytics views
- Program notes (clinician-facing)
- Consent & sharing controls
- Data export center

## 5) Analytics and visualization (MVP → advanced)
### 5.1 MVP analytics
- Frequency/rate over time
- Duration over time
- Intensity over time
- Simple moving average + trend line
- Context breakdown (top antecedents/locations/people)
- Reinforcement delivery rate (planned vs delivered)

### 5.2 Behavior analytic visuals (phase 2)
- Standard ABA line graphs with phase change lines
- Baseline vs intervention comparisons
- Celeration charts (optional)
- Scatterplot (time-of-day pattern)
- Conditional probability / lag sequential (lightweight)

### 5.3 “Micro-experiment” generator (guardrails)
- Suggest 1 small change at a time:
  - antecedent shift
  - reinforcement density change
  - prompt/fade adjustment
  - competing response insertion
- Require user/clinician confirmation before “running” an experiment
- Track experiment start/end and outcome

## 5.4 ABA graph spec (implementation target)

Graph rendering should support publishable ABA-style visuals (single-case focus):

- Y-axis:
  - include 0 baseline for count/duration/rate by default
  - configurable min/max, tick count, tick rounding
  - label + unit
- X-axis modes:
  - Trial mode: one point per entry (chronological); x-labels reflect date
  - Date mode: aggregate within-day (sum for count/duration unless overridden)
- Data point placement:
  - first point inset from Y-axis (do not start on the axis line)
- Phase changes:
  - stored as phase marker entries tied to a target template_version_id
  - render dashed vertical line between last point of prior phase and first point of next phase
  - baseline start marker is not rendered as a “change line”
- Multiple designs:
  - future: allow multiple concurrent phase streams (e.g., design_id) per target

## 6) Verbal Sage integration (AI layer)
### 6.1 AI boundaries
- Not diagnosis, not crisis care, not replacing clinician judgment
- AI outputs are coaching prompts + summaries + pattern hypotheses
- Always cite: “based on your logged data” and show the data slice used

### 6.2 AI features (safe + useful)
- Auto-summarize week: “what changed, where, and with whom”
- Draft operational definitions from user text (clinician approves)
- Suggest missing data fields (“you often log without context at 3–5pm”)
- Generate reinforcement ideas from preference constraints
- Turn data into relational prose reflections (optional, user-controlled)

### 6.3 AI as discriminative stimulus / reinforcement (optional)
- After logging replacement behavior: brief reinforcing feedback (user-chosen style)
- After problem behavior log: neutral, functional prompt (no shame language)
- “If-then” plan rehearsal (implementation intentions)

## 7) Data integrity, reliability, and clinical-grade options
### 7.1 Data quality flags
- Missing context rate
- Backfilled entries (entered long after timestamp)
- Outliers and improbable values
- Reinforcement not delivered when planned

### 7.2 Interobserver agreement (IOA) (optional module)
- Second observer entry
- IOA calculation by measurement type
- Discrepancy review workflow

### 7.3 Treatment integrity / fidelity (optional)
- Checklist for intervention steps
- Prompting hierarchy adherence
- Reinforcement delivery timing adherence

### 7.4 Auditability
- Immutable event log (append-only) or strong audit trail
- Versioned target definitions and plan changes

## 8) Notifications and habit shaping
- Reminders for:
  - scheduled observations (interval sampling)
  - nightly review
  - reinforcement delivery (if delayed)
- Streaks only if they don’t punish lapses (avoid shame loops)
- “Minimum viable day” mode: 1 tap + done

## 9) Privacy, security, and compliance considerations
- Encryption at rest and in transit
- Role-based access control
- Data minimization defaults
- Explicit consent for sharing and for AI processing
- Data retention policy + delete/export
- If targeting healthcare contexts: HIPAA alignment (BAA, logs, access controls)
- If minors: COPPA/FERPA considerations depending on deployment

## 10) Technical architecture (suggested)
- Mobile app (iOS/Android) + web dashboard
- Offline-first local store + background sync
- Event-sourcing or append-only log for observations
- Separate services:
  - Auth/identity
  - Data capture API
  - Analytics engine
  - AI summarization service (guardrailed)
- Feature flags for clinician-grade modules (IOA, fidelity, sessions)

## 11) MVP scope (ship first)
- Profiles + roles (basic)
- Targets (1–3 active) with operational definitions
- Fast event capture (frequency + duration + intensity)
- Simple context tags (location + people + activity)
- Basic graphs + weekly summary
- Export CSV
- Minimal AI: weekly summary + gentle prompts (opt-in)

## 12) Phase 2 scope (after MVP)
- Interval recording + latency
- Reinforcement schedule builder + thinning
- Phase change lines + advanced visuals
- Micro-experiments tracking
- IOA + fidelity modules
- Rich Verbal Sage relational prose integration

## 13) Open design decisions to lock early
- Self-management vs caregiver-first default
- How many active targets allowed (recommend 1–3)
- Default measurement types supported in MVP
- Context taxonomy: fixed list vs user-defined vs hybrid
- Data model choice: relational DB vs event store (or hybrid)
- AI opt-in defaults and what data it can see
- Compliance target (consumer wellness vs clinical/HIPAA)

## 14) Acceptance criteria (definition of “done” for MVP)
- User can create a target with an operational definition and measurement plan in < 3 minutes.
- User can record an event in < 3 seconds from the home screen.
- User can review/edit a day’s timeline in < 5 minutes.
- Graphs update correctly and reflect timezone and target versions.
- Export produces clean, analyzable CSV.
- Permissions prevent unauthorized viewing/editing.
- AI summaries are opt-in, cite the data window used, and never present as diagnosis.
```
