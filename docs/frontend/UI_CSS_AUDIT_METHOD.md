# Frontend UI and CSS Audit Method

Status: approved audit method

Last updated: 2026-07-29

Normative reference: `docs/frontend/WEB_DESIGN_STANDARD.md`

## Purpose

This is broader than a CSS audit. It examines the complete rendered interface and the implementation that produces it:

- visual consistency;
- responsive behavior;
- accessibility;
- theme behavior;
- interaction clarity;
- component reuse;
- CSS and utility-class maintainability;
- browser and device risks;
- performance and layout stability.

The audit is read-only. Findings do not authorize automatic redesign or bulk replacement.

## Scope

Audit all primary production surfaces:

- Verbal Sage Chat;
- LifeSwitch shell;
- Training;
- Nutrition;
- Plan;
- Measurements;
- People;
- Sage Helper;
- Personalization and Settings;
- Admin landing and drill-down pages;
- authentication and invitation pages;
- shared/public workout pages;
- active developer/internal pages that remain supported.

Legacy or dormant routes should be inventoried separately. Do not spend redesign effort on a route until its product status is confirmed.

## Evidence Sources

Use all of the following:

1. current production route inventory;
2. rendered desktop and phone pages with representative data;
3. light and dark themes;
4. keyboard-only interaction;
5. browser console and network errors;
6. source-level component and style inventory;
7. global CSS and theme tokens;
8. repeated Tailwind class patterns;
9. accessibility automation plus manual checks;
10. performance and layout-shift evidence.

Do not infer that a page is correct from source inspection alone.

## Audit Dimensions

### Visual hierarchy

- redundant frames and nested cards;
- inconsistent page widths or alignment;
- oversized controls;
- excessive rounding or shadows;
- weak distinction between primary and supporting content;
- inconsistent typography.

### Navigation and information architecture

- inconsistent labels or ordering;
- missing return paths;
- desktop/phone parity;
- duplicate navigation;
- hidden primary actions;
- obsolete or ambiguous routes.

### Forms and capture workflows

- unnecessary input boxes;
- ambiguous editable text;
- inconsistent label placement;
- poor unit/value alignment;
- inaccessible validation;
- duplicated settings;
- selected editors rendered far from their selected item.

### Responsive behavior

- horizontal overflow;
- clipped text or controls;
- fixed navigation covering content;
- unsafe viewport assumptions;
- poor touch targets;
- layout changes that remove core functionality;
- breakpoint-specific dead space or wrapping.

### Theme and color

- hard-coded colors that fail in another theme;
- inconsistent semantic meaning;
- contrast failures;
- invisible borders, focus, or disabled states;
- decorative color without purpose;
- excessive use of blue, purple, or tinted panels.

### Accessibility

- heading and landmark structure;
- keyboard navigation;
- focus visibility and order;
- accessible names;
- form labels and errors;
- color-only meaning;
- reduced motion;
- zoom and reflow;
- dialog, menu, and popover behavior.

### CSS and component maintainability

- repeated arbitrary values;
- repeated long class strings that represent one stable pattern;
- conflicting global rules;
- unnecessary `!important`;
- unused global selectors;
- page-specific CSS leaking globally;
- duplicate components with divergent styling;
- brittle positional selectors;
- high-specificity overrides;
- unsupported browser features without fallback.

### Performance and stability

- cumulative layout shift;
- costly blur or shadow layers;
- excessive animation;
- large unused style bundles;
- hidden content that still performs expensive work;
- unnecessary rerenders caused by layout measurement;
- mobile scroll locking problems.

## Required Viewports

At minimum, verify:

- 320 × 568;
- 390 × 844;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900.

Also check 200 percent browser zoom on representative pages.

## Required States

For each major workflow, inspect:

- populated;
- empty;
- loading;
- error;
- disabled;
- active selection;
- open menu or dialog;
- long label or long user content;
- keyboard focus;
- dark and light theme.

## Static Analysis

Collect:

- CSS files and their ownership;
- theme tokens and hard-coded colors;
- arbitrary Tailwind values;
- radius, shadow, blur, and border usage;
- `!important`;
- inline styles;
- fixed and sticky positioning;
- z-index values;
- overflow rules;
- animation declarations;
- duplicated class sequences;
- route-to-component ownership.

Static counts identify review targets; they are not findings until the rendered effect is examined.

## Severity

### P0 — Release blocker

- security-sensitive UI misrepresentation;
- destructive action can be triggered unintentionally;
- page or primary workflow is unusable;
- content is inaccessible to a substantial user group.

### P1 — High

- core mobile or desktop workflow breaks;
- serious accessibility failure;
- important state is misleading or invisible;
- consistent data entry is likely to fail.

### P2 — Medium

- significant inconsistency;
- nested or inefficient layout harms comprehension;
- maintainability issue is likely to cause drift;
- theme or breakpoint defect has a practical workaround.

### P3 — Low

- polish issue;
- minor spacing, alignment, or typography drift;
- low-risk cleanup.

## Finding Format

Every finding must include:

- unique ID;
- severity;
- route and viewport;
- screenshot or source evidence;
- observed behavior;
- expected behavior from the design standard;
- user impact;
- likely owning component or stylesheet;
- recommended change;
- confidence and any unverified assumption.

## Deliverables

The audit produces:

1. route and component inventory;
2. global CSS and token inventory;
3. visual consistency matrix;
4. accessibility and responsive findings;
5. CSS maintainability findings;
6. prioritized remediation backlog;
7. list of shared patterns worth extracting;
8. list of deliberate exceptions;
9. regression-check proposal.

## Remediation Rules

- Do not run a bulk global rewrite from static findings alone.
- Fix shared tokens or components only when affected pages have been verified.
- Separate visual cleanup from behavioral or backend changes.
- Preserve real user data and existing functionality.
- Use isolated candidates, representative data, phone review, tests, and rollback for production releases.
- Group fixes by shared cause, not only by route.

## Completion Criteria

The audit is complete when:

- every supported route is classified;
- every primary workflow has desktop and phone evidence;
- dark and light themes have representative coverage;
- all P0–P2 findings have an owner and recommended action;
- global CSS risks and shared-component opportunities are documented;
- legacy routes are separated from active product work;
- the user has reviewed the prioritized remediation sequence before implementation.
