# LifeSwitch Helper Context Model

## Purpose

The LifeSwitch helper is scoped to LifeSwitch. It is not a general Verbal Sage / Fractal Monism assistant.

Its current active product scope is:

- Unified Plan
- Nutrition
- Training
- Measurements

Behavior tracking and verbal/social-media analysis are explicitly out of current helper scope.

## Context Bundle

The helper context route builds a compact LifeSwitch bundle for the current user and page.

Current bundle areas:

- current unified plan
- recent nutrition logs and target adherence
- recent training and conditioning summaries
- recent measurement/body-state entries
- current page route, domain, and mode
- missing-data list
- backend access/data errors

## Auth Convention

The frontend helper context API route authenticates the current Supabase user.

At the frontend/backend boundary:

- `owner_user_id` = authenticated actor/viewer
- `target_user_id` = optional delegated data target

This follows the convention documented in:

- `docs/lifeswitch/PROXY_CONVENTION.md`

## Delegated Views

When the helper is opened on a delegated view, the frontend forwards `target_user_id` into the helper context request.

The helper context builder forwards that `target_user_id` into Brains calls for:

- plan profile
- nutrition day logs
- training sessions
- conditioning sessions
- measurement entries

Brains remains the permission boundary.

If the actor lacks permission for a target module, Brains returns an error such as 403. The helper context records that error instead of fabricating data.

## Security Rule

The helper must not bypass LifeSwitch relationship permissions.

Frontend read-only UI is not the security boundary.

Backend enforcement decides whether the actor can access the target's data.

Known backend relationship scopes currently relevant to helper context:

- `training:view`
- `nutrition:view`
- `measurements:view`
- `plan:view`
- `plan:comment`
- `plan:edit`

## Partial Context Is Expected

In delegated views, it is valid for the helper to receive partial context.

Example:

- actor has `training:view`
- actor does not have `nutrition:view`
- helper receives training context
- helper records nutrition access error
- helper should answer only from available context

## Prompt Rule

The helper prompt must tell the model:

- what page the user is on
- whether the view is delegated
- which context data is available
- which data is missing or blocked
- not to pretend it has logs, measurements, or plan values unless included in the bundle

## Future Improvements

Potential later improvements:

- fetch only page-relevant modules unless cross-domain analysis is requested
- distinguish unavailable-vs-unshared data more explicitly in the UI
- add module-specific helper capability checks if LifeSwitch tiers are activated
- expose a compact debug view of the helper context for admin/developer roles
