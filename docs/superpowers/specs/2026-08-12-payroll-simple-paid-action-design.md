# Payroll Simple Paid Action Design

The payroll period uses the canonical workflow `draft -> review -> closed -> paid`. A manager may mark only a `closed` run as `paid`; this action changes the run status only and creates no payroll payment record. The existing payment card and payment-entry controls are removed from the payroll screen.

The backend exposes `POST /api/v1/payroll/runs/:id/mark-paid`, guarded by `payroll:manage`. Its body contains `expectedVersion`, following the existing optimistic-concurrency workflow endpoints. The transition is audited with the actor, before/after status and versions. Any source status other than `closed`, including `paid`, returns a conflict. A paid period remains immutable and cannot be reopened.

On the payroll screen, managers see **Đánh dấu đã thanh toán** only while the run is `closed`. Clicking it opens a confirmation dialog because the transition is final. Confirming calls the new endpoint, reloads the period and shows a success or error toast. Readers and managers viewing other states do not see the button.

Coverage includes the domain transition, route permission, API client call, and UI visibility/confirmation behavior. Existing payment APIs may remain for compatibility, but the payroll screen no longer loads or exposes them.
