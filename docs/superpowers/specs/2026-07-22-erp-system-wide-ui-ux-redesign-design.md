# iGen ERP System-wide UI/UX Redesign

## Goal

Improve UI/UX across iGen ERP so customers can find features, read data, and finish tasks without information overload.

The redesign must preserve every existing module, feature, permission, workflow, API, data structure, calculation, validation rule, and business result. It may change only how features are organized and presented.

Current Vietnamese product copy is already accepted and must remain unchanged, except for technical display defects such as encoding errors.

## Feature preservation

Before changing a module, create a feature inventory containing:

- Existing screens and entry points.
- Features and actions on each screen.
- Roles allowed to use each feature.
- Inputs, outputs, validations, and side effects.
- Loading, empty, error, and success states.
- Links and transitions to other screens.

Every old feature must map to a discoverable location in the new UI. A feature may move, be grouped, collapse into an advanced section, or open in a menu, drawer, modal, or dedicated page. It must not disappear or change its business result.

## Information architecture

### System navigation

The sidebar shows only modules available to the current user. Modules are grouped into clear areas such as Overview, Operations, Tools, and System.

Each sidebar item contains an icon, module name, and active state. It does not contain a long description. The sidebar collapses on desktop and becomes a drawer on mobile.

### Module navigation

Features inside a module appear after the user enters that module. Frequently used features are visible directly. Less frequent features remain available in a clearly labeled secondary menu and require no more than three steps to reach.

### Screen navigation

Status tabs, filters, and pagination affect only the current screen. Their visual treatment must differ from system and module navigation.

## Progressive disclosure

Every screen uses three information levels:

1. Primary: title, important status, primary action, and commonly used data.
2. Secondary: less common filters, columns, properties, and actions revealed on demand.
3. Deep: reports, history, advanced settings, and detailed analysis in a drawer, modal, or dedicated page.

Hidden content must always have a clear, discoverable entry point.

## Standard screen templates

### List page

A list page contains a title, one primary action, search, common filters, an advanced-filter trigger, a data table or list, pagination, and result count.

Tables show five to seven important columns by default. Users may enable more columns, choose comfortable or compact density, and save preferences. A row shows only its most important action directly; remaining actions appear in an overflow menu. Mobile uses prioritized cards or lists instead of compressing a wide table.

### Detail page

A detail page prioritizes reading and decision-making. It contains the entity name, status, primary action, summary, and tabs for related information, activity, files, and history.

Viewing and editing are separate modes. Inline editing is limited to simple, low-risk fields.

### Form

Forms are divided into purposeful sections. Required and common fields appear first; advanced fields remain in expandable sections.

Long forms use a dedicated page or a multi-step flow only when the steps have clear business boundaries. Modals are reserved for short tasks. Save and cancel actions have consistent placement across modules.

### Module dashboard

A module dashboard summarizes status, exceptions, and work requiring attention. Detailed reports live on dedicated pages. Content may be prioritized by role without changing actual access permissions.

### Reports

Reports are separated from operational screens and use a common structure: time range and filters, important metrics, purposeful charts, source data, and export actions.

### Settings

Settings use a category list and a content area. Options are grouped by topic rather than placed on one long page.

## Action hierarchy

Each screen has one visually dominant primary action and no more than two or three directly visible secondary actions. Remaining actions use an overflow menu.

Accent color is reserved for the primary action. Red is reserved for errors, serious warnings, and destructive actions. Color must not be used merely to distinguish peer features.

## Search and quick access

Global search supports both features and business data the user is allowed to view. Results are grouped by type, such as features, employees, products, students, and resources.

Frequently used or favorite destinations may be pinned. Quick access supplements navigation; it does not replace the sidebar or module navigation.

## UI states

Every data screen and shared component supports:

- Loading.
- No data.
- No search results.
- Load failure.
- Successful action.
- Insufficient permission.

Empty states offer an appropriate next action when the user can create data. Recoverable errors preserve entered data and offer retry behavior.

## Responsive behavior and accessibility

- Desktop prioritizes efficient data operations.
- Tablet preserves all business capability in a flexible layout.
- Mobile prioritizes essential tasks and uses drawers and lists instead of wide tables.
- Touch targets are approximately 44 by 44 pixels or larger.
- Main text is at least 14 pixels and secondary text is at least 12 pixels unless a documented exception exists.
- Status is never communicated by color alone.
- Interactive components have focus states, accessible names, and logical keyboard order.

## Shared components

Prefer shared implementations for:

- App shell and sidebar.
- Page header and module navigation.
- Data toolbar and data table.
- Filter drawer and action menu.
- Pagination.
- Detail layout and form section.
- Status badge.
- Empty, loading, and error states.
- Confirm modal and right drawer.

A module must not create a new visual variant when a shared component already satisfies its business need. New variants preserve the same spacing, typography, states, and interaction behavior.

## Delivery phases

### Phase 1: Foundation

- Inventory all modules and existing features.
- Standardize app shell, sidebar, header, and module navigation.
- Finalize design tokens and foundation components.

### Phase 2: Data surfaces

- Standardize tables, search, filters, pagination, and bulk actions.
- Standardize loading, empty, and error states.

### Phase 3: View and input surfaces

- Standardize forms, modals, drawers, and detail pages.
- Move oversized modals to an appropriate page or flow without changing features.

### Phase 4: Module adoption

Apply the system to Human Resources, Inventory and Products, Student Management, Resources, Chat, User Administration, Wallet, Settings, and remaining modules. Reconcile every module against its feature inventory before completion.

## Testing

- Regression-test every existing feature and permission rule.
- Test shared components across all data states.
- Test keyboard access and accessible labeling.
- Test responsive layouts at primary breakpoints.
- Test representative employee, manager, and administrator tasks.
- Compare completion steps, completion time, and user errors before and after redesign.

## Acceptance criteria

- One hundred percent of existing features remain available through a clear entry point.
- APIs, data, permissions, and business results remain unchanged unless separately approved.
- A user can identify the primary screen action in about five seconds.
- Frequent features require no more than two steps; advanced features require no more than three.
- Each screen has only one visually dominant primary action.
- Tables show no more than seven columns by default unless a business exception is documented.
- Long forms are grouped or stepped appropriately.
- Visual behavior is consistent across modules.
- Current Vietnamese product copy is preserved and is not part of this redesign.

## Out of scope

- Removing or changing business features.
- Changing APIs or data structures only to serve a visual redesign.
- Changing permission or approval workflows.
- Replacing the frontend framework.
- Rewriting current Vietnamese terminology.
- Unrelated backend refactoring.
