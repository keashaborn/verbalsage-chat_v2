# LifeSwitch Frontend Proxy Convention

## Current Convention

LifeSwitch frontend API routes authenticate the current Supabase user and forward that identity to Brains as `owner_user_id`.

At the frontend proxy boundary, `owner_user_id` currently means:

- authenticated actor
- viewer
- current logged-in user

This is historically imperfect naming. It does not always mean the final data owner when a delegated view is being used.

## Delegated Views

Delegated LifeSwitch views may also send:

- `target_user_id`

When present, `target_user_id` means:

- the person whose LifeSwitch data is being viewed or edited

The backend receives both values:

- `owner_user_id` = authenticated actor/viewer
- `target_user_id` = delegated data target

The backend is responsible for resolving the actual data owner and enforcing permissions.

## Security Rule

Frontend read-only UI is not a security boundary.

Backend enforcement must decide whether the actor can access the target's data.

Known backend delegated permission checks include:

- `training:view`
- `nutrition:view`
- `measurements:view`
- `plan:view`
- `plan:comment`
- `plan:edit`

## Future Cleanup

A future naming cleanup may rename the frontend/backend boundary parameter:

- from `owner_user_id`
- to `actor_user_id`

Data tables may continue using `owner_user_id` where it means actual row/data owner.

Any rename should be done as a deliberate migration across frontend proxies, backend route parameters, helper context, and documentation.
