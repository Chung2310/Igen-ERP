# Task 10 brief: Resources and partners UI integration

Integrate shared custom fields only into `Khai báo tài nguyên mới` (`resources`) and `Khai báo đối tác mới` (`partners`) main forms, edit flows, and existing detail views. Do not touch categories, bookings, payouts, commission levels or action forms. No commit.

Files: `pages/Resources/components/AddResourceModal.tsx`, `pages/Resources/ResourcesPage.tsx` or existing detail component, `pages/Partners/components/AddPartnerModal.tsx`, `PartnerDetailModal.tsx`, relevant types, focused test.

Initialize/hydrate controlled `customFields`, render section before actions, include create/update payloads, preserve dirty/error state, render details in existing views. Exact keys resources/partners. Existing uploads/fixed validation unaffected.

Run focused test + typecheck; write task10 report; no build/commit.
