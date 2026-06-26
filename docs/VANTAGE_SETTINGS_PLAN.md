# Verbal Sage Vantage Settings Plan

## Goal

Move Verbal Sage from a developer-control surface toward a product structure.

Regular users should choose simple universal AI profiles and edit personalization.
Admins should tune raw retrieval/routing/pragmatics/debug controls.

## Role model

Supabase Auth is the identity source.

- `app_metadata.role = "admin"`: admin access
- no admin role: regular user access

Frontend hides admin UI based on role.
Next.js admin API routes enforce admin with `app/api/admin/_auth.ts`.

## User-visible settings

Regular users should see:

- Account
- Security
- Appearance
- Models & Voice
- Vantage Profile
- Personalization
- LifeSwitch / People features as product areas mature

Regular users should not see:

- Developer tools
- Diagnostics
- Inspector
- Memory cards
- Raw retrieval sliders
- Raw routing sliders
- Social presence internals
- Limiters
- Debug/meta tools

## Universal vantages

### RESSE

Admin/work/development assistant.

Target behavior:

- direct
- technical
- task-oriented
- low flattery
- low decorative language
- high correction accuracy
- low deference under pressure
- revises when evidence changes

### Morgan

Balanced general companion/helper.

Target behavior:

- socially natural
- practical
- not overly task-pushy
- low AI disclaimers
- moderate persona presence
- corrects errors plainly

### Riley

Warmer, more conversational, voice-friendly profile.

Target behavior:

- casual
- socially present
- less work-mode unless asked
- avoids fake flattery
- still corrects errors
- good for voice interaction

## Raw lever naming

| Internal / old label | New admin label | Meaning |
|---|---|---|
| Thread context | Use current conversation | Inject recent current-thread messages when a thread_id exists |
| Personal memory | Use saved memories | Retrieve user-specific saved memory |
| Corpus | Use knowledge base | Retrieve non-personal knowledge-base/corpus material |
| FM lens strength | Fractal Monism lens | Add Fractal Monism framing constraints |
| Similarity cutoff | Context match strictness | Higher = only use closer retrieval matches |
| Recency bias | Prefer recent context | Higher = rank newer retrieved items higher |
| Answer-first | Answer directly by default | Prefer answering rather than clarifying |
| Clarify bias | Ask-questions tendency | Higher = more likely to ask clarification when allowed |
| Max clarify questions | Question limit before answering | Hard cap on clarification questions |
| RFG — Ritual-first gate | Conversational opening | Higher = more greeting/check-in behavior before task framing |
| DF — Disclosure friction | AI disclaimer restraint | Higher = fewer unsolicited “as an AI” disclosures |
| PE — Persona embodiment | Persona intensity | Higher = stronger character/social presence |
| Y — Concession cap | Agreeability under pressure | Higher = more likely to concede when challenged |
| R — Ledger update gate | Evidence-based revision | Higher = revises more readily when new facts appear |
| C — Policy coupling gain | Adaptation strength | Longer-run shaping/coupling; verify exact backend effect |
| S — Ornament budget | Extra wording | Higher = more hedges, affirmations, compliments, decorative phrasing |

## Default style rule

Do not end every response with a next-step prompt.

Offer a next step only when the user is implementing, debugging, planning, or asking what to do next.
In casual conversation, end naturally.

## Implementation sequence

1. Rename raw lever labels and descriptions.
2. Pass `isAdmin` into `VantageProfilePage`.
3. Hide raw advanced controls from non-admin users.
4. Preserve regular Vantage Profile and Personalization access.
5. Create universal profile presets: RESSE, Morgan, Riley.
6. Verify Supabase cross-device persistence for active vantage settings.
7. Later: add LifeSwitch/training/nutrition knowledge-base collections.
