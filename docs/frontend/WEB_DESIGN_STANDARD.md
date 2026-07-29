# Verbal Sage and LifeSwitch Web Design Standard

Status: approved working baseline

Last updated: 2026-07-29

Reference implementation: the current LifeSwitch Training, Nutrition, Measurements, People, Settings, Admin, and Chat surfaces

## Purpose

This document records the visual and interaction decisions that should guide new pages and future redesigns. It is a product standard, not a description of every historical implementation.

When an existing page conflicts with this standard, treat the conflict as an audit finding. Do not copy the inconsistency into new work.

## Product Design Principles

### 1. Make the next action obvious

Each screen should answer three questions without explanation:

1. Where am I?
2. What information matters here?
3. What can I do next?

Prefer visible labels and familiar placement over clever interaction. Do not hide a primary workflow behind an unlabeled icon or an unexpected menu.

### 2. Use one visual container per concept

Avoid a card inside a card inside a framed page. A section should normally use one of these:

- whitespace and a heading;
- a thin horizontal divider;
- one outer boundary for a genuinely independent object;
- a row with separators for repeated records.

Do not add a rounded rectangle merely to make an element feel designed.

### 3. Create hierarchy with typography, spacing, and alignment

Use borders, shadows, color fills, and rounding sparingly. The default hierarchy is:

1. page title;
2. short explanatory text when needed;
3. section heading;
4. primary content;
5. supporting metadata.

### 4. Keep controls compact

Buttons and form controls should be large enough to use comfortably without appearing oversized or ornamental. High-frequency screens should favor dense, aligned rows.

### 5. Use the same language and placement everywhere

The same action should keep the same label, icon, visual priority, and approximate location across pages. Do not provide multiple unrelated places to change the same setting unless the workflow requires it.

### 6. Preserve information; remove visual noise

Minimalism means reducing unnecessary presentation, not removing useful functions or data. Every visible element should communicate information, enable an action, or establish hierarchy.

## Application Shell and Navigation

### Global shell

- Keep the LifeSwitch or Verbal Sage identity at the upper left.
- Keep Account at the upper right on desktop.
- Use the same content alignment and maximum-width behavior within a product area.
- Do not wrap the entire page in an additional decorative card.

### LifeSwitch workflow navigation

The canonical order is:

1. Log
2. Workouts
3. Capture
4. Plan
5. Analyze

Use this order consistently.

- Desktop: show the workflow navigation horizontally near the top.
- Phone: use the fixed bottom navigation.
- Opening LifeSwitch Training should lead to Log unless a task-specific deep link is used.
- Do not duplicate the phone bottom navigation at the top.

### Secondary navigation

Use a compact segmented control for two or three closely related views, such as Strength and Conditioning. A segmented control is navigation, not a collection of large buttons.

## Page Structure

### Header

A standard page header contains:

- a concise page title;
- at most one short sentence explaining the page;
- a date, range, refresh action, or primary action aligned opposite the title when relevant.

Avoid redundant product names, repeated descriptions, and headings that restate the selected navigation item without adding context.

### Sections

- Prefer `border-y` or `divide-y` treatment for structured working areas.
- Use whitespace between major sections.
- Use thin, low-contrast separators between related rows.
- Avoid stacking outer border, inner border, tinted background, and shadow on the same section.

### Cards

Cards are appropriate for:

- an independent summary metric;
- a selectable object;
- a floating menu or popover;
- a record that must read as a single unit;
- a temporary alert that needs clear separation.

Cards are not the default for:

- every form group;
- every accordion row;
- a page inside the application shell;
- each field inside a form;
- repeated records that can be represented as rows.

### Accordions

- Use flat rows with thin separators.
- Keep the section title and expand indicator on one line.
- Do not place every accordion row in a separate large rounded box.
- Expand only the content that belongs to the row.

## Typography

- Use the application sans-serif font consistently; currently this is Geist.
- Page titles should be clear but not oversized.
- Section headings should normally be small, semibold text.
- Metadata and field labels should be smaller and use muted foreground color.
- Use uppercase with modest tracking only for compact column or field labels.
- Use tabular numerals for measurements, dates, sets, repetitions, duration, and summary statistics.
- Do not introduce a different font weight or family to make one module feel distinct.

## Color and Theme

### Theme rules

- Graphite is the default theme.
- Slate, Mist, and Paper remain supported.
- Use semantic theme tokens rather than hard-coded black, white, or page-specific grays.
- New components must be checked in both a dark theme and a light theme.
- Preserve sufficient contrast in muted text, borders, focus rings, and disabled controls.

### Semantic colors

- Blue: links, focus, selection, and interactive emphasis.
- Green: success and completed Strength activity.
- Dark gold: Conditioning activity and restrained caution emphasis.
- Red: destructive actions and errors.
- Neutral foreground: ordinary status and classification.
- Purple is not a default product color. Use it only if a distinct, documented semantic category requires it.

Do not use color only for decoration. Do not create a new color meaning on a single page.

### Training activity

| Activity | Calendar treatment | Notes |
| --- | --- | --- |
| Strength | Green date number | Primary training activity |
| Conditioning | Dark-gold date number | Warm but not bright yellow |
| Strength + Conditioning | Green date number with a short gold underline | One date, two recorded activity types |
| No log | Neutral date number | No filled or outlined activity block |
| Rehab | Not encoded on the calendar | Preserve Rehab in session details and analysis where relevant |

Calendar dates should not use large outlined or filled rectangles for routine activity. Legends and accessible labels must explain the color meaning.

### Nutrition activity

Use the same restrained semantic approach as Training. Nutrition-specific colors may distinguish target status, but the state must also be understandable from text, value, or icon.

## Borders, Rounding, and Elevation

- The global radius is intentionally moderate, currently approximately `0.45rem`.
- Use rounded corners for controls, navigation selection, menus, and independent cards.
- Prefer square or gently rounded message and content surfaces over large capsules.
- Reserve pill shapes for compact status, filters, or segmented selection.
- Use borders at low contrast and usually at partial opacity for internal separators.
- Use shadows only when elevation communicates layering, such as a menu, popover, sticky composer, or floating navigation.
- Do not combine a heavy border, strong shadow, tinted fill, and large radius without a functional reason.

## Buttons and Actions

### Priority

Each section should normally have:

- zero or one primary action;
- optional secondary actions;
- destructive actions separated from routine actions.

### Appearance

- Keep routine buttons compact.
- Use text buttons or lightly bordered buttons for secondary actions.
- Avoid large black buttons when a quieter neutral or blue treatment communicates the action.
- Do not make every action look primary.
- Disabled controls must remain legible and clearly inactive.

### Menus

- Use a vertical ellipsis for per-record actions such as View and Delete.
- Keep the ellipsis aligned at the row edge.
- Use a labeled button when the action itself is primary or must be immediately obvious.
- Do not repeat a large `Actions` button on every list item.

### Destructive actions

- Use explicit language such as Delete, Remove, Discard, or Revoke.
- Use red only inside the final action surface, not as a decorative section color.
- Confirm irreversible or high-impact actions.

## Forms and Data Entry

### Standard forms

Settings, account, security, and creation forms may use visible input boundaries. Keep them in one flat section rather than nested cards.

### High-frequency capture

Training and Nutrition capture should emphasize rapid entry:

- align values in rows or columns;
- use borderless fields inside a clearly structured row;
- use thin separators between rows;
- keep units beside their values;
- show prior values when they help the current entry;
- avoid a rounded box around every number.

An editable value can look like text when its placement and label make editability clear. It must still provide an obvious focus state.

### Labels and instructions

- Every control needs a visible or accessible label.
- Placeholder text is an example, not a label.
- Keep helper text directly beneath the related field.
- Remove system or implementation status text that does not help the user make a decision.

### Selection

- Use a select control for a short, stable list.
- Use a searchable list when the collection can become long.
- Show the list before searching when browsing is useful.
- Move a selected item's editor directly beneath the selected row or item instead of placing it below the entire collection.

## Lists, Tables, and Repeated Records

- Prefer one aligned row per record.
- Use thin separators instead of a rounded card per row.
- Keep the title, type, important metadata, and actions on the same visual line when space allows.
- On phone, allow metadata to wrap beneath the title while actions remain discoverable.
- Use plain colored text for simple classifications when a badge adds unnecessary weight.
- Use a badge only when the status must be scanned as a discrete state.

## Status, Badges, and Indicators

- Prefer plain text for routine categories such as Strength, Rehab, or Conditioning.
- Do not show the same classification in multiple nearby controls.
- Use a compact badge for exceptional status, warning, pause, or active version.
- Small indicators may supplement a primary category but must not distort alignment.
- Do not use tiny unexplained marks. Icons, letters, and colors need accessible text.

## Feedback and Empty States

- Show success or error feedback close to the action.
- Keep success messages short and calm.
- Explain an empty state and provide the next relevant action.
- Do not frame an empty state with multiple borders.
- Loading, restored-draft, and autosave messages should be visible without dominating the page.

## Responsive Behavior

### Phone

- Preserve the fixed bottom navigation and provide enough bottom padding so content is not obscured.
- Keep touch targets at least 44 by 44 CSS pixels where practical.
- Stack long text fields instead of clipping meaningful content.
- Keep short numerical pairs in aligned two-column rows when readable.
- Do not force desktop cards into a narrow single column if a flatter row treatment works better.
- Prevent horizontal page scrolling at 320 CSS pixels.
- Respect safe-area insets.

### Desktop

- Use the available width without stretching text or controls unnecessarily.
- Keep totals or summary metrics horizontal when they remain readable.
- Align controls to a common grid.
- Use resizable split panes when the user may need to inspect long names or content.

### Responsive parity

Do not intentionally remove a core workflow from phone merely because it is more comfortable on desktop. Adapt its layout unless there is a documented product reason to limit it.

## Chat-Specific Decisions

- The conversation sidebar should be resizable within sensible minimum and maximum widths.
- User messages should be visually distinct, right aligned, moderately inset from the left, and less pill-like.
- Avoid showing a redundant assistant name above every response.
- Keep the composer compact and approximately one line when idle.
- Keep voice and send controls small, clear, and near the composer corner.
- Remove implementation labels such as transcription provider, generation state, or live-voice readiness unless they help recover from an error.
- `Powered by Verbal Sage` may remain as restrained footer text.

## LifeSwitch-Specific Decisions

### Training

- Capture uses Strength and Conditioning as the two primary modes.
- Strength Capture uses exercise sections and compact set rows.
- Conditioning Capture should use the same flat session hierarchy and compact measurement rows.
- Rehab classification belongs where the workout or exercise is defined and in relevant session detail, not in repeated calendar decoration.
- The Training calendar uses colored date numbers rather than large activity boxes.

### Nutrition

- Food and meal selection should support both immediate browsing and search.
- Quantity and serving-unit controls should read as aligned values rather than isolated boxes.
- Log actions should be compact and professional.
- A selected food or meal editor belongs directly beneath the selected item.
- Nutrition Analyze should follow the same flat summary and section hierarchy as Training Analyze.

### Plan

- Training and Nutrition use one unified LifeSwitch Plan.
- The AI-assisted planner must remain available on both desktop and phone.
- Plan sections use flat accordion rows, not a stack of separate rounded cards.

### Measurements and People

- Use the same flat sections, compact actions, and clear navigation as Training and Nutrition.
- People pages must make the path back to the user's own view obvious.
- Permission language must distinguish current state from the action that changes it.

### Settings and Admin

- Remove frames that only repeat an outer boundary.
- Group related settings with headings and separators.
- Keep voice choices visually selectable without wrapping each layer in another card.
- Use rectangular or gently rounded language and model selectors rather than oversized capsules.
- Admin landing items may be independent cards; drill-down content should use flat sections and tables.

## Glass and Translucency

Apple-style glass is an accent, not the foundation of the interface.

Appropriate uses:

- sticky navigation;
- bottom navigation;
- floating composer;
- popover or transient overlay.

Avoid glass:

- behind dense forms;
- on every card;
- where it reduces contrast;
- as a substitute for hierarchy.

Use subtle transparency and blur only when the surface is genuinely layered over content.

## Accessibility

- Meet WCAG 2.2 AA contrast for text and meaningful controls.
- Preserve visible keyboard focus.
- Support keyboard operation for menus, dialogs, segmented controls, and resizable panes.
- Use semantic headings and landmarks.
- Provide accessible names for icon-only controls.
- Do not rely on color alone to communicate an actionable or safety-relevant state.
- Respect `prefers-reduced-motion`.
- Maintain readable zoom and reflow at 200 percent.
- Announce asynchronous success and error messages when appropriate.

## Implementation Rules

- Prefer semantic theme tokens: `background`, `foreground`, `muted`, `border`, `input`, `ring`, `primary`, and `destructive`.
- Prefer Tailwind utilities and shared components over new page-specific CSS.
- Do not use arbitrary hard-coded colors when a semantic token exists.
- Extract a shared pattern after it is repeated and stable; do not create abstractions before the interaction is understood.
- Avoid `!important` except for a documented platform workaround.
- Keep global CSS for tokens, resets, shared shell behavior, and genuinely global platform fixes.
- Keep component-specific layout with the component.
- Do not hide overflow to conceal a broken responsive layout.
- Document intentional exceptions beside the implementation.

## Review Checklist

Before approving a new or changed page, confirm:

- The page has one obvious hierarchy and no redundant outer frame.
- There are no nested decorative cards.
- Primary, secondary, and destructive actions have distinct priority.
- Repeated records use aligned rows where appropriate.
- Inputs are neither needlessly boxed nor ambiguously editable.
- Typography and font weight match adjacent modules.
- Color meanings match the semantic palette.
- Dark and light themes both work.
- The page works at 320, 390, 768, 1024, and wide desktop widths.
- Fixed navigation does not obscure content.
- Keyboard focus and accessible names are present.
- Empty, loading, success, error, and disabled states are understandable.
- The page does not expose implementation details as user-facing status.
- The same setting is not unnecessarily editable in multiple places.

## Decision Governance

- This document is the baseline for new work.
- A deliberate exception must state the user need that justifies it.
- A repeated exception should trigger a design-standard revision rather than page-by-page divergence.
- Design changes should be reviewed with real user data on desktop and phone before production deployment.
- Update this document when an approved design decision changes the universal standard.
