# Recruitment Job Status Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move JD status editing from the detail dialog to a dropdown in each jobs-list row.

**Architecture:** Reuse the existing `changeStatus` handler and `recruitmentApi.changeJobStatus` endpoint. The list component owns one in-flight job ID, renders the existing status column as a controlled dropdown, and reloads authoritative server data after success or failure.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, `recruitmentApi`.

## Global Constraints

- Keep the existing `draft`, `open`, `paused`, and `closed` status values and Vietnamese labels.
- Remove status editing from the JD detail dialog.
- Remove the `Mở tuyển` and `Tạm dừng` action buttons.
- Do not change backend APIs or database models.

---

### Task 1: Move JD status editing to the jobs table

**Files:**
- Modify: `src/components/hr/recruitment/RecruitmentJobsView.tsx:1-350`
- Test: `src/components/hr/recruitment/RecruitmentTab.test.tsx`

**Interfaces:**
- Consumes: `recruitmentApi.changeJobStatus(id: string, version: number, status: RecruitmentJobStatus)`.
- Produces: A controlled dropdown labeled `Trạng thái <job.code>` that updates the existing status endpoint and disables itself while saving.

- [ ] **Step 1: Write the failing component test**

Add `changeJobStatus: vi.fn()` to the recruitment API mock, reset it in `beforeEach`, then add:

```tsx
it("updates a job status from the jobs list instead of the detail dialog", async () => {
  vi.mocked(recruitmentApi.changeJobStatus).mockResolvedValue({ ...job, status: "paused", version: 1 });
  render(<RecruitmentTab />);
  await screen.findByText("Developer");

  const statusSelect = screen.getByRole("combobox", { name: "Trạng thái DEV" });
  expect(statusSelect).toHaveValue("open");
  expect(screen.queryByTitle("Mở tuyển")).toBeNull();
  expect(screen.queryByTitle("Tạm dừng")).toBeNull();

  await userEvent.selectOptions(statusSelect, "paused");
  await waitFor(() => expect(recruitmentApi.changeJobStatus).toHaveBeenCalledWith("job", 0, "paused"));

  await userEvent.click(screen.getByRole("button", { name: "Sửa tin tuyển dụng DEV" }));
  expect(within(screen.getByRole("dialog")).queryByLabelText("Trạng thái")).toBeNull();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/components/hr/recruitment/RecruitmentTab.test.tsx
```

Expected: FAIL because no list-row status combobox exists and `changeJobStatus` is not present in the mock.

- [ ] **Step 3: Implement the minimal UI behavior**

In `RecruitmentJobsView.tsx`:

```tsx
import { Archive, Pencil, Plus } from "lucide-react";

const [changingStatusJobId, setChangingStatusJobId] = useState<string | null>(null);

const changeStatus = async (job: RecruitmentJob, next: RecruitmentJobStatus) => {
  if (next === job.status) return;
  setChangingStatusJobId(job._id);
  try {
    await recruitmentApi.changeJobStatus(job._id, job.version, next);
    await load();
  } catch (e: any) {
    setError(e.status === 409 ? "Dữ liệu đã thay đổi. Danh sách đã được tải lại." : e.message);
    await load();
  } finally {
    setChangingStatusJobId(null);
  }
};
```

Replace the status badge with:

```tsx
<select
  aria-label={`Trạng thái ${job.code}`}
  className={`${fieldClass} min-w-32 py-2`}
  value={job.status}
  disabled={changingStatusJobId === job._id}
  onChange={(event) => void changeStatus(job, event.target.value as RecruitmentJobStatus)}
>
  {Object.entries(statusLabel).map(([value, label]) => (
    <option key={value} value={value}>{label}</option>
  ))}
</select>
```

Delete the `Mở tuyển` and `Tạm dừng` action-button blocks. Delete the labeled status `<select>` from `JobDialog` so create/edit payloads retain the form's default/current status without exposing that field in the dialog.

- [ ] **Step 4: Run tests and typecheck to verify GREEN**

Run:

```bash
npx vitest run src/components/hr/recruitment/RecruitmentTab.test.tsx server/validation/recruitment.validation.test.ts
npm run typecheck
git diff --check
```

Expected: all tests PASS, TypeScript exits 0, and diff check exits 0.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/components/hr/recruitment/RecruitmentJobsView.tsx src/components/hr/recruitment/RecruitmentTab.test.tsx
git commit -m "feat(recruitment): edit job status from list"
```