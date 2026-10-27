# Clone các thay đổi giao diện Marketing mới vào ERP

Written against: ERP `4cf0484d`; Marketing source `3d99d04` compared with `cddce65`.
Selected by user: đồng bộ giao diện Marketing mới sang ERP, 2026-10-27.
Clarified by user: clone đúng UI mới từ Marketing; chỉ áp dụng cho chức năng ERP hiện có. Không triển khai chat sửa kế hoạch, simulator hoặc lưu lead mới.

## Evidence chain

- Surface: `src/modules/marketing-suite/navigation.ts` links Campaign, Message Facebook, Knowledge and Marketing settings into the existing ERP shell.
- Problem: the initial semantic redesign did not copy the new Marketing presentation closely enough. The user explicitly selected the source UI, including its actual layout, authored styles and supporting assets, for existing ERP functionality.
- Design evidence: `DESIGN.md`, semantic tokens in `src/index.css`, mandatory UI workflow in `AGENTS.md`.
- Owner: existing Marketing page and component files, with ERP shared controls and tokens.
- Scope: the existing Marketing screen family; upstream `3d99d04` provides the exact UI source, ERP remains authoritative for available operations and data contracts.
- Uncertainty: browser authentication and seeded states may limit rendered verification; report actual evidence and limitations.

## Design decision

Copy the actual frontend visual changes from Marketing `cddce65..3d99d04` into corresponding ERP components: JSX composition, layout, colors, icons, spacing, display copy, filters and relevant assets. Adapt imports and bind them to ERP's existing handlers, authorization, subscription quotas and media policies. The user's explicit source-UI selection takes precedence over the earlier semantic redesign. Scope source palette and typography rules to Marketing so ERP's surrounding application stays intact. Retain the fixes for toast visibility and nested-dialog Escape handling.

## Reuse

- Marketing source frontend files and scoped copies of their required CSS/assets. ERP `src/index.css` remains authoritative outside the cloned Marketing surface.
- `src/components/common/StyledSelect.tsx`, existing modal/focus infrastructure, existing Lucide icons, native date/time inputs where appropriate.
- `cn` from `src/modules/student-management/lib/utils.ts` for new conditional class composition.
- Exemplar: `src/modules/marketing-suite/shared/pages/MarketingIntegrationsPage.tsx` for page title and scope navigation; preserve its existing configuration sections.

## Changes

1. Campaign planner/detail/history/calendar/sheet (`campaign/components/marketing`): clone source presentation for existing ERP actions, including the new brief/history composition, platform logos and date picker. Preserve ERP campaign setup and AI estimate/confirmation, uploads, field locks, revision conflicts and autosave. Omit unsupported chat-revision interactions. Copy the small source UI deltas in existing approval modals and embedded Campaign image/voice/bulk tools.
2. Analytics and Campaign page shell: clone source report layout, metric cards, filter appearance, empty-state presentation and tab styling. Keep ERP request sequencing, date validation, error handling, data normalization and export behavior. Preserve keyboard support when copying custom controls.
3. Message, Knowledge and integration pages: apply source visual deltas, source platform/filled icons and document selector presentation to corresponding ERP controls. Preserve account scope, settings, catalog/knowledge actions and permissions. Exclude new simulator and Lead Sheet UI that require new backend features.
4. Scope copied palette and authored typography to `marketing-workspace` / `campaign-detail-modal`, including source sentence-case and Campaign detail font-weight rules. Source app login/logo, global ERP shell, standalone media studios and new backend workflows are excluded.

## Scope

- Inherit: existing ERP Marketing routes and their dialogs, list/table, loading, empty, error and disabled states.
- Verify: company AI quota affordances, Campaign estimate text, uploaded-video flow, Facebook tabs, connected-account choices, knowledge scopes and theme switching.
- Exclude: backend/API/model changes, standalone Marketing repository edits, ERP login/global sidebar/dashboard redesign, subscription behavior, standalone image/video/HeyGen tools and simulator/lead/draft-revision feature additions.

## Validation

- Product: existing actions stay attached to the same handlers and services; no call to an unavailable upstream endpoint is introduced.
- Interface: inspect 390, 768 and 1440 px when rendering is available; include keyboard focus, long Vietnamese strings, horizontal tables, loading/empty/error and supported dark theme.
- System: compare copied JSX/classes/assets against the actual Marketing source. Use `baseline-ui` and `fixing-accessibility` for required keyboard/naming fixes without redesigning the explicitly requested source appearance.
- Repository: targeted ESLint, `npm run typecheck`, `npm run build`. The user's check-and-fix request also authorizes running existing regression tests; no new test files are needed for cosmetic changes.

## Stop conditions

- A visual change needs a new backend contract: use the existing ERP operation for this synchronization and record the separate feature requirement.
- Existing unrelated changes appear: preserve them and restrict edits to owned Marketing UI files.
- Required rendering depends on real account credentials: use isolated mock rendering when possible and report the limitation.

## Design documentation

- `DESIGN.md` remains the governing contract. This accepted plan records the selected Marketing synchronization scope and can be updated with completed verification.

## Completed source clone and verification — 2026-10-27

- Implemented on `feat/marketing-ui-sync` using Marketing `3d99d04`. The standalone source repository remains clean. No backend, dependency, environment or global ERP shell changes were introduced.
- Copied source Campaign brief/history/setup, detail, calendar, sheet/date picker, report cards/charts/filters, Message, Knowledge and integration presentation. Included source icons, platform SVGs and the small UI deltas in existing approval and embedded Campaign media components.
- Preserved ERP services, permissions, company scope, protected credential reveal, subscription estimates/confirmation, autosave/revision guards and uploaded-video policy. Single-post creation retains `publishNow: isSinglePost`. Unsupported source chat revision, simulator and Lead Sheet features are excluded.
- Retained the source-styled “Chiến lược tổng” tab so existing ERP strategy data remains reachable. Scoped source colors/typography to Marketing, adapted its colors for ERP dark mode and fixed mobile detail footer wrapping. Platform logos use their isolated `/marketing-suite/` asset paths.
- Fixed notifications hidden behind native modal layers, same-turn close/success feedback loss, nested Escape handling, focus return and body scroll restoration. Chrome regression checks covered global/parent/child feedback, deduplication, dismissal and nested unmount.
- Recovered UTF-8 strings in PromptBox, CampaignItem and CalendarTab after an intermediate copy lost Vietnamese accents. Inspected restored source strings and rendered Vietnamese before final validation.
- Passed: ESLint on all 42 changed TypeScript/TSX files, `npm run lint`, `npm run typecheck`, `npm run build`, nine existing test files / 24 tests, UTF-8 inspection and `git diff --check`. The build retains the existing bundle-size warning above 500 KB.
- Rendered the actual cloned components with mocked auth/API at 390, 768 and 1440 px: Campaign shell/planner, Analytics, Message, Knowledge and integrations. Also reviewed Calendar, Inbox, comment configuration, report empty/error/loading states and dark theme. Verified Campaign setup logos, strategy access, the 390 px footer and keyboard selection/focus return in report filters.
- Verification limitation: preview fixtures do not exercise live Facebook, Google Drive, AI provider calls or database mutations. No new automated test files, installs, commit or push were performed.
- Cleanup: stopped the isolated preview server and verified/closed its dedicated Chrome process; removed its temporary profile and screenshots.
