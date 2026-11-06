# Match overview KPI card sizing and icon placement

Written against: `0f51c8f5d86636ec1cabf6eff1812153db223eb0`

## Evidence chain

- Surface: ERP overview KPI rows in `DashboardTab`, `BusinessDashboardTab`, and the student and worker dashboards.
- Problem: the user reports that statistic cards in other sections feel larger than the Finance overview cards.
- Design evidence: `DESIGN.md` documents shared semantic tokens and a consistent overview KPI pattern; Finance renders six cards with `min-h-28`, `12px 14px` padding, and a `gap-3` grid.
- Owner: `src/modules/finance/finance-overview.css` owns `.finance-kpi`; `src/components/dashboard/overview-dashboard.css` owns `.overview-kpi`.
- Scope and affected surfaces: Finance, Retail, HR, Student, Labor, Marketing, Business overview KPI rows and existing dashboard consumers of `.overview-kpi`.
- Uncertainty: none; the user selected Finance as the visual size reference.

## Design decision

Use the Finance card's 112px minimum height, 12px vertical and 14px horizontal padding, and 12px grid gap for overview statistic cards. Place one 16px decorative Lucide icon at the upper right of each card, with no backing shape and consistent on-primary color at reduced opacity. Use the Finance/POS `text-lg font-semibold` heading size for the other visible KPI group headings. Keep each dashboard's labels, values, comparison data, responsive column count, and interaction.

## Reuse

- Existing `.finance-kpi`, `.overview-kpi`, and Tailwind `min-h-28` patterns.
- Existing metric-specific Lucide icons where available; use `aria-hidden` for decorative icons.
- Exemplar: `src/modules/finance/components/FinanceOverviewDashboard.tsx`.

## Changes

1. Overview KPI styles and consumers
   - Change: align `.overview-kpi` and `.finance-kpi` minimum height and padding with Finance; use `gap-3` for the overview KPI grids; remove per-card padding overrides and add the shared minimum to Retail. Put one small, unbacked metric icon at the upper right of each KPI card. Give visible KPI group headings a shared `text-lg font-semibold` hierarchy and wrap the HR KPI row in its titled `overview-panel`.
   - Preserve: module-specific labels, values, colors, comparison values, responsive column counts, loading states, and navigation.
   - Verify: all overview KPI rows use the same card sizing, grid spacing, and icon size and placement at mobile and desktop widths.

## Scope

- Inherit: cards using the existing overview KPI style owners.
- Verify: Finance, Retail, HR, Student, Labor, Marketing, Business, Student Management, and Worker Management dashboard KPI rows.
- Exclude: chart cards, financial detail cards, report filters, data calculations, and standalone non-dashboard statistics.

## Validation

- Product: confirm each section retains its labels, values, deltas, and actions.
- Interface: render at 390, 768, and 1440 px; inspect loading, empty, error, dark, hover, and focus states where supported.
- System: reuse the existing KPI style owners and preserve semantic theme tokens.
- Repository: `npm run typecheck`, targeted overview Vitest files, `npm run build`.

## Stop conditions

- Stop if a dashboard uses `.overview-kpi` for non-statistic content or relies on a larger height to fit required content.

## Design documentation

- None; reuse the existing overview KPI decision.
