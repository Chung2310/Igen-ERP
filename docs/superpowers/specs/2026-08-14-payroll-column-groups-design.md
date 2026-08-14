# Payroll Table Column Groups Design

## Goal

Make the payroll results table easier to scan by grouping columns into clear visual sections without changing payroll data, permissions, calculations, or API behavior.

## Approved design

- Add a grouped header row for employee information, editable payroll components, deductions, and net pay.
- Keep the existing per-column header row beneath it.
- Use subtle group-specific backgrounds and stronger vertical separators at group boundaries.
- Keep the employee column sticky during horizontal scrolling.
- In the employee column, show only the employee name; hide the employee ID and the “Chưa phát hành” status text from the rendered table.
- Keep editable cells visually distinct from read-only deduction and net-pay cells.
- Preserve the hidden fixed period-input columns and the existing editable-field rules.

## Acceptance criteria

- Both payroll table variants render the same four group labels and their existing column labels.
- The employee column remains visible while horizontally scrolling.
- Employee cells contain the employee name only and do not render an employee ID or “Chưa phát hành”.
- Editable result fields remain inputs; deduction totals and net pay remain read-only.
- Existing payroll table behavior and data requests remain unchanged.
- Component tests assert group headers and the editable/read-only distinction.
