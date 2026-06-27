# LifeSwitch Client Identity Cleanup

## Current Direction

Supabase user ID is the canonical LifeSwitch identity.

LifeSwitch frontend pages should prefer this flow:

Client page
  -> /api/lifeswitch/* route
  -> route resolves Supabase user server-side
  -> route injects owner_user_id into Brains request
  -> Brains enforces owner/delegated access

## Current State

Most /api/lifeswitch/* proxy routes already use getLifeSwitchOwnerUserId(req) and injectOwnerUserId(...).

That means normal self-routes do not need the client to call /api/auth/whoami first.

## Important Clarification

/api/auth/whoami is not a separate non-Supabase identity system. It currently wraps getSupabaseUserIdFromRequest(req).

The issue is not that whoami uses the wrong identity source.

The issue is that some LifeSwitch client pages still do this redundant pattern:

1. call /api/auth/whoami
2. store owner in client state
3. send owner_user_id back to /api/lifeswitch/*

That is more fragile than letting the LifeSwitch API proxy resolve identity server-side.

## Cleanup Goal

Gradually remove client-side whoami dependency from LifeSwitch self-routes.

Remove:
- owner state used only for self identity
- authErr state tied only to whoami
- client owner_user_id query params
- client owner_user_id JSON body fields

Keep:
- authFetch
- target_user_id for delegated read-only views
- server-side owner injection in /api/lifeswitch/*
- backend permission enforcement

## Migration Rule

Do not mass-edit all pages at once.

Migrate one page/component at a time, then test:
- data loads
- create/update/delete works
- delegated views still work where applicable
- mobile and desktop behavior match

## First Candidate

Nutrition Capture is a good first candidate because these API routes already inject owner server-side:
- /api/lifeswitch/nutrition/my_foods
- /api/lifeswitch/nutrition/meals
- /api/lifeswitch/nutrition/my_food_overrides
- /api/lifeswitch/nutrition/log/entry
