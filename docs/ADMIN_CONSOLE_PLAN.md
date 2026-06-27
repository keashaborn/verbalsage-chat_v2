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
