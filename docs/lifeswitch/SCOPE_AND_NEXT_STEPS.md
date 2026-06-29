# LifeSwitch / Verbal Sage Scope and Next Steps

## Current Product Scope

LifeSwitch is now focused on a narrower, stronger core:

- Plan
- Nutrition tracking
- Weightlifting/training tracking
- Measurements
- People/support/sharing infrastructure
- Verbal Sage core chat

The goal is to make these areas solid before expanding scope.

## Parked Legacy Areas

The following areas remain in the codebase but are not active priority:

- `/collect`
- `/lifeswitch/behavior/*`
- `/lifeswitch/verbal/*`
- `components/lifeswitch/CapturePage.tsx`
- generic SSLG/forms capture system
- `components/lifeswitch/NutritionQuickLogDialog.tsx`

These should not be deleted yet because they may be useful later, but they should not drive current architecture decisions.

## Completed Identity Cleanup

Client-side LifeSwitch ownership lookup has been removed from the current Nutrition and Training systems.

The current rule is:

- Clients call `/api/lifeswitch/*`
- API proxy routes resolve owner identity server-side
- API proxy routes inject `owner_user_id`
- Client pages should not call `/api/auth/whoami`
- Client pages should not send `owner_user_id: owner`

## Remaining Known Legacy Identity Exceptions

Legacy components may still contain old owner patterns:

- `components/lifeswitch/CapturePage.tsx`
- `components/lifeswitch/NutritionQuickLogDialog.tsx`

These are parked and should not be patched unless they return to active scope.

## Admin / Permissions Status

Enterprise-style permissions are not built yet.

Desired future direction:

- More than simple admin/user
- Admin
- Developer
- Beta tester
- Regular user
- Possibly support/helper roles
- Permission-gated diagnostics
- Permission-gated memory/card inspection
- Permission-gated admin tools
- Permission-gated model/provider controls

This should be designed deliberately after core LifeSwitch routes are stable.

## Provider Simplification Direction

Likely near-term simplification:

- Consolidate LLM path around OpenAI
- Remove or de-emphasize Grok/provider switching
- Simplify voice/model settings
- Avoid maintaining multiple provider systems before the core app is stable

## Suggested Next Work Order

1. Finish route/navigation audit for parked Behavior/Verbal/Collect areas.
2. Hide or label parked routes if they appear in current UI.
3. Review Plan functionality.
4. Review Analyze functionality for Nutrition, Training, and Measurements.
5. Then design Sage helper context bundle.
6. Later design enterprise admin/user permissions.
7. Later consolidate LLM/provider settings.
