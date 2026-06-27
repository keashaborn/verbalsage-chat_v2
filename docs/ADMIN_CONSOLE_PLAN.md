# Admin Console Plan

## Purpose

Build a professional admin system for Verbal Sage that separates normal user preferences from system-level configuration, developer tools, security operations, and future product administration.

## Standing Principles

- Prefer Supabase-backed persistent state over browser-cookie state when the setting affects identity, permissions, cross-device consistency, or user experience.
- Make the product more user-friendly without dumbing it down: preserve advanced power, but reduce confusing labels, developer-facing UI, unnecessary friction, and unsafe workflows.
- Frontend hiding is convenience. Backend enforcement is security.

## Current Admin Authorization

Current admin authorization uses Supabase JWT verification through app/api/admin/_auth.ts and requireAdmin(req).

Current role check: payload.app_metadata.role === "admin".

This is acceptable for the current stage. Long-term direction is Supabase roles table, custom access token hook, JWT role claims, RLS, user management, and audit logging.

## Admin Route Hardening

All current /api/admin routes now require requireAdmin().

Current admin routes:
- /api/admin/cards
- /api/admin/cards/[card_id]
- /api/admin/debug_cookie
- /api/admin/delete_all
- /api/admin/export
- /api/admin/forget_recent
- /api/admin/vantage-cards

Security hardening completed: delete_all, export, and forget_recent were upgraded from authenticated-user routes to admin-only routes.

## Target Admin Console

Admin Console should eventually include:
- System
- Users
- Roles & Permissions
- Vantage Controls
- Built-in Vantages
- Memory / Cards
- Security
- Diagnostics

Initial shell can start smaller: Developer Tools, Memory Cards, Security, Vantages, Diagnostics.

## Vantage Control Registry

Goal: centralize Vantage lever definitions so labels, descriptions, visibility, editability, category, and risk level are controlled from one registry instead of scattered component logic.

Example controls: conversation, memory_cards, corpus, lens_fm, recency_bias, similarity_threshold, answer_first, clarify_bias, max_clarify_questions, rfg, df, pe, Y, R, C, S.

Permission states should eventually include: hidden from users, visible but locked, visible and editable, admin-only.

Important: /api/chat must enforce these permissions server-side. A normal user should not be able to send hidden admin-only knobs directly in a request body.

## Supabase-First State Direction

Target: Supabase is canonical for active Vantage and persistent settings. Cookies/localStorage should be short-term cache only.

Future improvement: built-in Vantage versioning so built-in updates refresh cleanly without requiring manual re-Apply.

## Future Vantage Controls

The current Vantage controls should not be treated as final. Several current levers were created to solve specific observed behavior problems. The registry should support both current controls and future better-organized controls.

Likely future user-facing controls:

- Response length: brief, balanced, detailed.
- Social warmth: minimal, natural, warm.
- Decorative language: plain, expressive, stylized.
- Initiative / next-step tendency: wait for direction, suggest when useful, actively guide workflow.
- Correction style: gentle, direct, strict.
- Domain mode: general, technical/workflow, behavior-change, philosophical, social/conversational, fitness/nutrition.
- Process discipline: conversational, careful, strict verification.
- Memory scope: none, current project only, user preferences, personal history, broad memory.
- Context relevance discipline: loose associative, balanced, strict relevance only.
- Motivational orientation: experimental future control for shaping whether the assistant merely responds, gently prompts action, supports reflection, or actively guides behavior change.

Important product note: avoid assistants that force unsolicited next-step lists or pull unrelated prior context just because it appeared earlier. Context should be functionally relevant, not merely available.

## Build Sequence

1. Harden current admin routes. Status: completed for known routes.
2. Create Admin Console shell.
3. Move Developer Tools into Admin Console.
4. Extract Vantage control registry.
5. Add configurable Vantage exposure.
6. Add server-side Vantage enforcement in /api/chat.
7. Add mature Supabase RBAC, user management, and audit logs later.
---

## 2026-06-27 Admin Console Checkpoint

### Completed

- Sensitive `/api/admin/*` routes now require admin authorization.
- The old Developer section was renamed to Admin Console.
- Admin Console shell now includes:
  - Prompt Inspector
  - Model Diagnostics
  - Vantage Controls / Control Registry
  - Vantage Permissions placeholder
  - Memory System Status placeholder
  - Memory Cards
- User-facing Vantage language was changed to Assistant Profile / Active Profile.
- Internal/admin terminology remains Vantage where technically appropriate.
- `/api/chat` and `/api/chat/inspect` now use Supabase auth context with `user_id`, `role`, and `is_admin`.
- Non-admin users can use visible Assistant Profile controls but cannot manually force hidden/admin-only Vantage controls through request bodies or cookies.
- Prompt Inspector is now admin-only server-side.
- Prompt Inspector UI is hidden for non-admin users and stale Inspector payloads are cleared when switching accounts.

### Current Security Boundary

Frontend visibility is convenience only. Server-side enforcement is now active for:

- Inspector/debug access.
- Non-admin Vantage control stripping.
- Sensitive admin routes.

### Known Future Work

- Replace duplicate admin auth helper logic with the shared Supabase auth context helper.
- Convert Vantage Permissions placeholder into a real policy table.
- Add explicit Inspector metadata showing whether hidden controls were stripped.
- Build Memory System Status into a real diagnostic panel.
- Audit old Developer routes such as `/developer/diagnostics`, `/developer/forms`, and `/developer/sslg`.
- Decide whether admin routes should be hidden from routing entirely for non-admin users, not just inaccessible.
- Eventually move more profile/config state from browser cookies to Supabase-backed persistent state.

### Recommendation

Pause Admin Console expansion here. The foundation is sufficient. Next work should return to product functionality unless a specific security issue appears.
---

## 2026-06-27 Capability System Progress

### Added

- Static capability registry added at `components/admin/settings/permissions/permissionRegistry.ts`.
- Admin Console now displays the capability registry read-only.
- Shared `requireCapability(req, capabilityKey)` helper added at `app/api/_auth/requireCapability.ts`.
- Admin auth helper now reuses the shared Supabase auth context.
- Memory card view routes now enforce `memory_cards.view`.
- Prompt Inspector route now enforces `inspector.view`.

### Current Enforcement Model

- Roles are read from Supabase `app_metadata.role`.
- Static default role grants are defined in the capability registry.
- Capability helper currently evaluates role defaults only.
- No custom per-user overrides or database-backed policy table exist yet.

### Current Limitation

The registry is the conceptual source of truth, but only selected routes are wired to it so far. Several routes still use `requireAdmin()` directly and should be migrated one route family at a time.

### Recommended Next Route Families

1. `diagnostics.view` / `diagnostics.run`
2. `user_data.export`
3. `user_data.delete`
4. `user_data.forget_recent`
5. `memory_cards.delete`
6. later: LifeSwitch shared-access capabilities
---

## 2026-06-27 Capability Enforcement Checkpoint

### Route Families Converted

The following routes now use the capability authorization helper:

- `inspector.view`
  - `/api/chat/inspect`
  - `/api/admin/debug_cookie`

- `memory_cards.view`
  - `/api/admin/cards`
  - `/api/admin/vantage-cards`

- `memory_cards.delete`
  - `/api/admin/cards/[card_id]`

- `user_data.export`
  - `/api/admin/export`

- `user_data.delete`
  - `/api/admin/delete_all`

- `user_data.forget_recent`
  - `/api/admin/forget_recent`

- `voice.realtime_token`
  - `/api/voice/ws-token`

### Current Guard Audit

- Active `/api/admin/*` routes no longer call `requireAdmin()` directly.
- `requireAdmin()` remains defined only as a compatibility helper.
- Most ordinary application routes still use `getSupabaseUserIdFromRequest()`, which is appropriate for user-authenticated routes.
- `/api/dev/models` remains unauthenticated and currently returns only a static model allowlist.
- `/api/telemetry/event` can accept anonymous telemetry but stamps `actor_user_id` when authenticated.

### Security Position

The core admin/security surface has moved from binary admin checks toward explicit capability enforcement. This is a stronger base for future roles such as developer, operator, beta tester, power user, coach/helper, and owner.

### Recommended Next Work

- Add an effective-permissions preview for the current account.
- Add database-backed role/capability overrides later.
- Add capability checks to future diagnostics routes.
- Keep `/api/dev/models` public only if it remains a harmless static allowlist.
- Revisit anonymous telemetry if telemetry payloads become sensitive or abusable.

