# Frontend BFF Route Audit Checkpoint

Date: 2026-06-30
Server: Verbal Sage frontend
Path: /var/www/verbalsage-chat_v2
Branch: main

## Purpose

This checkpoint documents the frontend Backend-for-Frontend audit after the Brains backend service-token and actor-ownership hardening pass.

BFF means Backend-for-Frontend.

In this system, the Next.js API routes act as the trusted frontend server layer between browser clients and the Brains backend.

## Required upstream headers

Protected Brains routes require:

    x-vs-service-token

User-owned routes also require:

    x-vs-actor-user-id

The frontend BFF is responsible for resolving the authenticated Supabase user and forwarding that user id as the actor header.

## Shared helpers inspected

Inspected:

    app/api/_brains/headers.ts
    app/api/lifeswitch/_owner.ts

Confirmed:

    brainsUpstreamHeaders(...)
    - sends x-vs-service-token from VS_SERVICE_TOKEN
    - sends x-vs-actor-user-id when actorUserId is supplied

    lifeSwitchUpstreamHeaders(...)
    - sends x-vs-service-token from VS_SERVICE_TOKEN
    - sends x-vs-actor-user-id when owner_user_id is supplied

## LifeSwitch route audit result

Automated LifeSwitch BFF ownership audit found one apparent issue:

    app/api/lifeswitch/nutrition/log/entry/route.ts

Manual inspection showed this was a false positive caused by multiline formatting.

Confirmed that route:

    - resolves owner_user_id through getLifeSwitchOwnerUserId(req)
    - rejects unauthorized requests
    - injects owner_user_id into the upstream query
    - stamps owner_user_id into POST body
    - sends lifeSwitchUpstreamHeaders(rid, owner_user_id, ...)
    - therefore forwards both service token and actor header

Final classification:

    Active LifeSwitch BFF routes: clean

## Active route categories

### Clean active protected routes

The following categories use shared BFF header helpers with actor forwarding where required:

    LifeSwitch nutrition
    LifeSwitch training
    LifeSwitch plan
    LifeSwitch measurements
    LifeSwitch people/sharing
    Verbal Sage chat
    Chat inspect/feedback
    Threads
    User instructions
    Admin cards/vantage-cards
    Admin export/delete/forget-recent
    Identity
    Metrics
    Telemetry
    Vantages sync
    Profiles apply_default

### Intentional public catalog routes

Catalog routes do not send the service token and are treated as intentional public/search endpoints:

    app/api/catalog/exercises/search/route.ts
    app/api/catalog/foods/search/route.ts
    app/api/catalog/foods/usda/search/route.ts

These align with the backend public catalog exemption.

### Intentional public preview routes

LifeSwitch share/invite preview routes call Brains without an actor:

    app/api/lifeswitch/people/invitations/preview/route.ts
    app/api/lifeswitch/training/workout_template_shares/preview/route.ts

These align with backend public-preview exemptions.

## Legacy Forms caveat

The following Forms BFF routes call Brains with service token but no actor:

    app/api/forms/entries/list/route.ts
    app/api/forms/entries/route.ts
    app/api/forms/publish/route.ts
    app/api/forms/templates/[owner_user_id]/[template_id]/route.ts
    app/api/forms/templates/[owner_user_id]/route.ts
    app/api/forms/versions/[version_id]/route.ts

These are used by:

    components/sslg/SSLGPanel.tsx
    components/forms/FormsBuilderPage.tsx
    components/lifeswitch/CapturePage.tsx

Classification:

    Parked legacy / out of current LifeSwitch scope

Reason:

    The current product scope prioritizes LifeSwitch Plan, nutrition, training, measurements, and people/sharing.
    Behavior, Verbal, /collect, SSLG, generic forms capture, and older capture infrastructure are parked legacy areas.

Recommendation:

    Do not patch Forms during the OpenAI/Grok consolidation pass.
    Later either:
    - remove/deprecate Forms routes and old UI surfaces, or
    - redesign Forms auth with actor ownership before making them active product surfaces again.

## Current conclusion

The active frontend BFF paths required by the current LifeSwitch and Verbal Sage scope are correctly forwarding the service token and actor header.

The only remaining caveat is parked legacy Forms infrastructure, which should be handled as a separate product/security decision.
