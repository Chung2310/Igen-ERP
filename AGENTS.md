# Igen ERP agent instructions

## Project stack

- The frontend is React 19, TypeScript, Vite, and Tailwind CSS 4.
- The backend is Node.js and Express.
- Preserve the existing Vietnamese product language and the semantic theme tokens in `src/index.css`.

## Mandatory UI workflow

These rules apply whenever a task creates or changes user-facing UI, including files under `src/pages`, `src/components`, and frontend modules.

1. Before editing, inspect `DESIGN.md` when it exists and reuse the existing design tokens, components, and interaction patterns.
2. If `DESIGN.md` is absent, use the `create-design-md` skill before broad UI work. A narrow bug fix may proceed from existing repository evidence, but it must not invent a new visual language.
3. Prefer existing shared components. Do not create a new button, input, select, dialog, card, badge, or table style when an existing component or documented pattern can express it.
4. Prefer semantic Tailwind tokens such as `bg-surface`, `text-on-surface`, `border-outline`, `bg-primary`, and `text-on-primary`. Do not introduce direct palette colors or arbitrary values unless the design contract requires them.
5. After implementation, use the `baseline-ui` skill on every changed UI file and fix supported violations before finishing.
6. When changing forms, dialogs, menus, tabs, dropdowns, keyboard behavior, focus behavior, or icon-only controls, also use the `fixing-accessibility` skill.
7. For a broad UI cleanup or design-system drift audit, use the `improve-ui` skill first. It produces evidence-backed plans; implement only the changes the user selects.
8. When browser tooling is available, verify changed surfaces at 390 px, 768 px, and 1440 px widths. Check loading, empty, error, disabled, hover, focus, and dark-mode states that the surface supports.

## Verification

- Run `npm run typecheck` after TypeScript changes.
- Run the relevant Vitest files for changed behavior.
- Run `npm run build` before completing a broad frontend change.
- Report any verification that could not be run. Do not claim visual verification without rendering the affected surface.
