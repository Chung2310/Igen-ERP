# Thi?t k? v?n h�nh k? luong Vi?t Nam

## 1. M?c ti�u v� ph?m vi

Giai do?n n�y x�y d?ng quy tr�nh v?n h�nh k? luong ho�n ch?nh tr�n n?n d? li?u v� engine t�nh luong chi ti?t c?a giai do?n foundation. Ph?m vi b?t d?u t? t?o k?, d?ng b? v� kh�a c�ng; ti?p t?c qua t�nh, r� so�t, duy?t v� ch?t; k?t th�c b?ng thanh to�n, c�ng b? phi?u luong v� xu?t d? li?u.

Thi?t k? kh�ng l?p l?i c?u h�nh h?p d?ng, h? so payroll, ch�nh s�ch, danh m?c kho?n luong ho?c c�ng th?c thu? v� b?o hi?m. C�c ph?n d� l� d?u v�o b?t bu?c t? k? ho?ch `2026-07-30-vietnam-payroll-foundation.md`.

## 2. Nguy�n t?c thi?t k?

- Tri?n khai theo t?ng l�t c?t nghi?p v? ch?y xuy�n su?t thay v� ho�n th�nh to�n b? backend r?i m?i l�m UI.
- `PayrollRun` l� aggregate trung t�m c?a m?t k? luong.
- D? li?u c�ng v� k?t qu? t�nh d� ch?t l� snapshot b?t bi?n.
- K? d� ch?t kh�ng du?c m? l?i; sai s�t du?c x? l� b?ng k? b? sung ho?c adjustment c?a k? sau.
- M?i thao t�c ghi quan tr?ng d�ng optimistic concurrency v� audit tru?c/sau.
- T�c v? d�i ch?y du?i d?ng job c� th? ti?p t?c theo d�i sau khi t?i l?i trang.
- M?i d? li?u du?c gi?i h?n theo `companyCode` v� `branchId` theo quy?n c?a ngu?i th?c hi?n.

## 3. Ki?n tr�c aggregate

### 3.1. PayrollRun

M? r?ng `PayrollRun` hi?n c� d? ch?a:

- C�ng ty, chi nh�nh, kho?ng ng�y, th�ng luong v� lo?i k? `regular` ho?c `supplemental`.
- `version`, tr?ng th�i workflow v� tr?ng th�i job hi?n t?i.
- Tham chi?u snapshot c�ng d� kh�a.
- C�c d�ng luong chi ti?t theo nh�n vi�n v� `calculationRevision` dang d�ng.
- T?ng thu nh?p, b?o hi?m, thu?, th?c nh?n, chi ph� doanh nghi?p, d� thanh to�n v� c�n ph?i tr?.
- L?i ch?n, c?nh b�o, x�c nh?n c?nh b�o v� l?ch s? t�nh l?i.
- Ngu?i t?o, r� so�t, duy?t, ch?t c�ng th?i di?m tuong ?ng.
- Checksum c?a snapshot v� k?t qu? khi ch?t.

M?t c�ng ty/chi nh�nh kh�ng du?c c� hai k? `regular` ch?ng kho?ng ng�y. K? `supplemental` ph?i tham chi?u k? g?c ho?c ghi r� l� do nghi?p v?.

### 3.2. PayrollAttendanceSnapshot

Snapshot c�ng luu d? li?u d� d�ng d? t�nh cho t?ng nh�n vi�n:

- C�ng chu?n, ph�t l�m th?c t? v� c�ng hu?ng luong.
- Ph�p hu?ng luong, ngh? kh�ng luong, thi?u gi? v� v?ng m?t.
- Tang ca d� duy?t theo nh�m ng�y thu?ng, ng�y ngh?, ng�y l?, ban d�m v� tang ca ban d�m.
- Ngu?n d? li?u, phi�n b?n ngu?n v� th?i di?m kh�a.

Sau khi kh�a, thay d?i ? d? li?u ch?m c�ng ngu?n kh�ng t? s?a snapshot. Mu?n l?y d? li?u m?i ph?i m? m?t k? chua ch?t v? bu?c ph� h?p theo state machine; kh�ng cho thay snapshot c?a k? d� `closed`.

### 3.3. PayrollAdjustment

Adjustment bi?u di?n ph? c?p, thu?ng, hoa h?ng, kh?u tr?, t?m ?ng, truy linh ho?c truy thu ph�t sinh theo k?. M?i b?n ghi luu d?nh nghia kho?n luong, s? lu?ng, don gi�, s? ti?n, l� do, t?p ch?ng t?, ngu?i t?o v� tr?ng th�i duy?t.

Adjustment d� du?c dua v�o revision t�nh luong ph?i du?c snapshot trong d�ng luong. Thay d?i adjustment sau khi t�nh l�m k? c?n t�nh l?i. K? kh�ng du?c duy?t n?u c�n adjustment ch? duy?t.

### 3.4. PayrollPayment

M?i l?n thanh to�n l� m?t aggregate ri�ng, g?m ph?m vi ngu?i nh?n, s? ti?n t?ng nh�n vi�n, ng�y d? ki?n/th?c t?, phuong th?c, t�i kho?n ngu?n, m� giao d?ch, ch?ng t?, ngu?i l?p, ngu?i x�c nh?n v� `idempotencyKey`.

Tr?ng th�i payment l� `draft -> confirmed`, `draft -> cancelled` ho?c `confirmed -> reversed`. Payment d� x�c nh?n kh�ng du?c s?a. Sai s�t du?c d?o b?ng `reversed`, sau d� t?o payment m?i.

### 3.5. PayrollAudit v� PayslipPublication

`PayrollAudit` luu m?i chuy?n tr?ng th�i, d?ng b?, kh�a, t�nh l?i, thay d?i adjustment, duy?t, ch?t, thanh to�n v� c�ng b? phi?u luong. B?n ghi g?m actor, th?i di?m, d? li?u tru?c/sau, l� do v� correlation ID.

`PayslipPublication` luu th?i di?m c�ng b?/thu h?i, ph?m vi nh�n vi�n v� ngu?i thao t�c. Thu h?i ch? thay d?i quy?n truy c?p, kh�ng thay d?i n?i dung phi?u luong.

## 4. State machine k? luong

Lu?ng ch�nh:

```text
draft
  -> attendance_locked
  -> calculated
  -> reviewed
  -> approved
  -> closed
  -> partially_paid
  -> paid
```

Quy t?c chuy?n tr?ng th�i:

- `draft`: cho ph�p d?ng b? l?i danh s�ch nh�n vi�n v� d? li?u c�ng.
- `attendance_locked`: snapshot c�ng d� b?t bi?n; cho ph�p b?t d?u t�nh.
- `calculated`: c� revision k?t qu? h?p l?; cho ph�p t�nh l?i, x? l� c?nh b�o v� adjustment.
- `reviewed`: ngu?i r� so�t x�c nh?n d? li?u; thay d?i c� ?nh hu?ng ti?n dua k? v? `calculated`.
- `approved`: d? di?u ki?n ch?t; t? ch?i duy?t dua k? v? `calculated` v� b?t bu?c c� l� do.
- `closed`: snapshot v� d�ng luong ch? d?c, c� checksum; kh�ng cho quay v? tr?ng th�i tru?c.
- `partially_paid` v� `paid`: du?c suy ra t? t?ng payment `confirmed` chua b? `reversed`.

Ch? k? `draft` du?c d?ng b? c�ng l?i. K? `calculated` du?c t�nh l?i t? snapshot c�ng d� kh�a; kh�ng thay snapshot. Vi?c c?n l?y d? li?u c�ng m?i ph?i t?o l?i k? tru?c khi duy?t ho?c t?o k? b? sung n?u k? g?c d� ch?t.

## 5. Lu?ng t?o k? v� kh�a c�ng

1. Ngu?i c� quy?n t?o k? ch?n c�ng ty, chi nh�nh, kho?ng ng�y v� lo?i k?.
2. H? th?ng ki?m tra kho?ng k? tr�ng v� t?o `PayrollRun` ? `draft`.
3. �?ng b? l?y nh�n vi�n c� h?p d?ng hi?u l?c trong k?, k? c? nh�n vi�n ch? hi?u l?c m?t ph?n k?.
4. H? th?ng ki?m tra c�ng, ph�p v� tang ca chua duy?t, d? li?u thi?u ho?c ngu?n d� thay d?i.
5. Ngu?i d�ng x? l� l?i v� c� th? d?ng b? l?i khi k? c�n `draft`.
6. Kh�a c�ng t?o snapshot b?t bi?n, ghi audit v� chuy?n k? sang `attendance_locked`.

API:

```text
POST /payroll/runs
POST /payroll/runs/:id/sync-attendance
POST /payroll/runs/:id/lock-attendance
GET  /payroll/runs/:id/issues
```

## 6. Lu?ng t�nh, r� so�t, duy?t v� ch?t

Resolver ch?n h?p d?ng, di?u kho?n luong, h? so payroll, ngu?i ph? thu?c, ch�nh s�ch v� c�c kho?n thu?ng xuy�n theo ng�y hi?u l?c. N?u m?c luong d?i gi?a k?, d? li?u du?c chia th�nh c�c segment tru?c khi g?i engine foundation.

M?i l?n t�nh th�nh c�ng t?o m?t `calculationRevision`. Revision m?i thay revision dang d�ng nhung revision cu v?n du?c tham chi?u trong audit. T�nh th?t b?i kh�ng ghi d� k?t qu? dang d�ng.

Ngu?i r� so�t x? l� l?i/c?nh b�o, duy?t adjustment v� x�c nh?n c�c c?nh b�o du?c ph�p b? qua. Ch? k? kh�ng c�n l?i ch?n ho?c adjustment ch? duy?t m?i chuy?n sang `reviewed`.

Ch? k? `reviewed` m?i du?c duy?t. N?u c�ng ty b?t ph�n t�ch nhi?m v?, ngu?i t?o kh�ng du?c l� ngu?i duy?t. T? ch?i duy?t dua k? v? `calculated` v� luu l� do.

Ch?t k? ki?m tra l?i version, checksum, l?i v� tr?ng th�i; sau d� ghi checksum cu?i, kh�a snapshot c�ng d�ng luong v� chuy?n sang `closed`.

API:

```text
POST  /payroll/runs/:id/calculate
POST  /payroll/runs/:id/recalculate
POST  /payroll/runs/:id/review
POST  /payroll/runs/:id/approve
POST  /payroll/runs/:id/reject
POST  /payroll/runs/:id/close
PATCH /payroll/runs/:id/lines/:employeeId/adjustments
```

## 7. Thanh to�n

Thanh to�n ch? du?c t?o cho k? t? `closed` tr? di. M?t payment c� th? bao ph? to�n k?, m?t nh�m nh�n vi�n ho?c m?t nh�n vi�n. T?ng ti?n ph�n b? cho m?i nh�n vi�n kh�ng du?c vu?t s? c�n ph?i tr?, tr? thao t�c d?o payment d� x�c nh?n.

`idempotencyKey` l� duy nh?t trong ph?m vi c�ng ty v� thao t�c thanh to�n. G?i l?i c�ng key v� c�ng payload tr? v? k?t qu? cu; c�ng key nhung payload kh�c tr? l?i xung d?t.

Tr?ng th�i `partially_paid` xu?t hi?n khi t?ng thanh to�n h?p l? l?n hon 0 nhung nh? hon t?ng th?c nh?n. `paid` ch? xu?t hi?n khi m?i d�ng h?p l? d� du?c thanh to�n d?. Payment `reversed` l�m h? th?ng t�nh l?i tr?ng th�i k?.

API:

```text
POST /payroll/runs/:id/payments
POST /payroll/payments/:id/confirm
POST /payroll/payments/:id/cancel
POST /payroll/payments/:id/reverse
GET  /payroll/runs/:id/payments
```

## 8. Phi?u luong v� xu?t d? li?u

Phi?u luong l?y ho�n to�n t? snapshot c?a revision d� ch?t. N?i dung g?m th�ng tin nh�n vi�n v� ng�n h�ng d� snapshot, c�ng v� tang ca, t?ng kho?n thu nh?p, b?o hi?m nh�n vi�n, thu?, kh?u tr?, th?c nh?n v� tr?ng th�i thanh to�n.

HR du?c xem b?n nh�p t? `calculated`. Nh�n vi�n ch? du?c xem phi?u c?a ch�nh m�nh sau khi c�ng b?. C�ng b? ho?c thu h?i kh�ng s?a snapshot v� du?c audit.

H? th?ng xu?t b?n lo?i Excel:

- B?ng luong chi ti?t.
- T?ng h?p b?o hi?m.
- T?ng h?p thu? TNCN.
- Danh s�ch chuy?n kho?n ng�n h�ng.

M?i lu?t xu?t luu lo?i b�o c�o, b? l?c, ngu?i xu?t, th?i di?m v� checksum k?. D? li?u ng�n h�ng ch? c� trong file c?a ngu?i du?c c?p quy?n thanh to�n. CSV cu ti?p t?c ho?t d?ng trong giai do?n chuy?n d?i.

API:

```text
POST /payroll/runs/:id/payslips/publish
POST /payroll/runs/:id/payslips/unpublish
GET  /payroll/runs/:id/payslips/:employeeId
GET  /payroll/runs/:id/exports/:type
GET  /employee/me/payslips
```

## 9. Giao di?n v?n h�nh

`PayrollTab` g?m:

- Danh s�ch k? luong theo chi nh�nh, th�ng v� tr?ng th�i.
- Wizard hi?n th? bu?c hi?n t?i, di?u ki?n ho�n t?t v� t�c v? ti?p theo.
- B?ng d�ng luong c� c?t c?u h�nh, t�m ki?m, l?c l?i/c?nh b�o v� h�ng t?ng h?p.
- Ngan chi ti?t nh�n vi�n g?m c�ng, thu nh?p, b?o hi?m, thu?, kh?u tr?, payment v� l?ch s? adjustment.
- H�ng d?i r� so�t l?i, c?nh b�o v� adjustment.
- M�n h�nh duy?t/ch?t c� b?n t?ng h?p, x�c nh?n v� l� do nghi?p v?.
- Tab thanh to�n, phi?u luong v� xu?t b�o c�o.

�?ng b?, t�nh luong v� xu?t Excel ch?y du?i d?ng job. UI polling tr?ng th�i job, hi?n th? ti?n d? v� k?t qu? l?i theo nh�n vi�n. Vi?c t?i l?i trang kh�ng h?y job ho?c l�m m?t kh? nang theo d�i.

## 10. Ph�n quy?n v� b?o m?t d? li?u

Quy?n t?i thi?u:

- `payroll:read`
- `payroll:prepare`
- `payroll:review`
- `payroll:approve`
- `payroll:close`
- `payroll:pay`
- `payroll:publish_payslip`
- `payroll:self_read`

M?i truy v?n v� mutation ki?m tra `companyCode`, `branchId` v� permission ? backend. D? li?u tr? v? du?c gi?i h?n theo quy?n: s? t�i kho?n, m� s? thu?, m?c luong v� chi ti?t thu? kh�ng du?c d?a v�o vi?c UI t? ?n.

## 11. L?i, c?nh b�o v� t�nh nh?t qu�n

L?i nghi?p v? tr? c?u tr�c ?n d?nh:

```ts
interface PayrollIssue {
  code: string;
  message: string;
  runId: string;
  employeeId?: string;
  field?: string;
  severity: "blocking" | "warning";
  remediation: string;
}
```

L?i ch?n g?m thi?u h?p d?ng ho?c m?c luong hi?u l?c, thi?u ch�nh s�ch, c�ng/don chua duy?t, kho?ng hi?u l?c ch?ng nhau, adjustment ch? duy?t, s? ti?n kh�ng h?p l? v� l?ch checksum.

C?nh b�o g?m thi?u m� s? thu? ho?c t�i kho?n ng�n h�ng, m?c d�ng kh�c thu?ng, kho?n mi?n thu? vu?t gi?i h?n, th?c nh?n bi?n d?ng l?n v� kh?u tr? vu?t thu nh?p. C?nh b�o ch? du?c b? qua khi lo?i c?nh b�o cho ph�p v� ngu?i d�ng c� quy?n r� so�t; x�c nh?n ph?i luu l� do.

M?i mutation nh?n `expectedVersion`. Xung d?t tr? m� l?i ?n d?nh v� b?n version m?i nh?t d? UI y�u c?u t?i l?i. Job th?t b?i du?c retry an to�n theo idempotency key; kh�ng t?o hai revision ho?c hai payment do retry.

## 12. Ki?m th?

### Unit test

- State machine v� c�c chuy?n tr?ng th�i kh�ng h?p l?.
- Resolver d? li?u theo ng�y hi?u l?c v� chia segment gi?a k?.
- T�nh t?ng payment, d?o payment v� tr?ng th�i `partially_paid`/`paid`.
- Checksum, idempotency v� ph�n lo?i l?i/c?nh b�o.

### Integration test

- API to�n lu?ng, validation, optimistic concurrency v� audit.
- Company/branch scope v� t?ng permission.
- Retry job kh�ng t?o revision, export ho?c payment tr�ng.
- K? d�ng kh�ng th? b? s?a qua b?t k? endpoint mutation n�o.

### UI test

- Wizard ph?n �nh d�ng tr?ng th�i v� di?u ki?n c�n thi?u.
- N�t thao t�c b? kh�a theo tr?ng th�i, permission v� job dang ch?y.
- B?ng d�ng luong, ngan chi ti?t, x? l� issue v� adjustment.
- Thanh to�n nhi?u d?t, c�ng b? phi?u v� quy?n nh�n vi�n t? xem.

### Acceptance v� regression

- To�n lu?ng t? t?o k? d?n thanh to�n d?, g?m m?t l?n t�nh l?i v� m?t payment b? d?o.
- T? ch?i duy?t r?i s?a adjustment v� duy?t l?i.
- K? b? sung x? l� sai s�t sau ch?t m� kh�ng s?a k? g?c.
- Phi?u luong v� b?n lo?i Excel d?i chi?u d�ng snapshot.
- K? luong cu v� CSV cu v?n d?c/xu?t du?c qua adapter tuong th�ch.

## 13. Chia giai do?n tri?n khai

### Phase 2A: T?o k?, d?ng b? v� kh�a c�ng

Ho�n thi?n aggregate k?, state machine ban d?u, snapshot c�ng, issue preflight, job d?ng b? v� wizard bu?c d?u.

### Phase 2B: T�nh chi ti?t v� r� so�t

T�ch h?p engine foundation, resolver hi?u l?c, calculation revision, adjustment, c?nh b�o v� giao di?n d�ng luong.

### Phase 2C: Duy?t, ch?t v� audit

Ho�n thi?n review/approve/reject/close, ph�n t�ch nhi?m v?, checksum, optimistic concurrency v� audit d?y d?.

### Phase 2D: Thanh to�n

Th�m payment nhi?u d?t, idempotency, confirm/cancel/reverse, ch?ng t? v� b?ng chuy?n kho?n.

### Phase 2E: Phi?u luong v� b�o c�o

Th�m c�ng b?/thu h?i, self-service, PDF phi?u luong, b?n lo?i Excel v� adapter xu?t CSV cu.

## 14. �i?u ki?n ti�n quy?t v� ngo�i ph?m vi

Phase 2 y�u c?u c�c interface, model v� calculator trong `2026-07-30-vietnam-payroll-foundation.md` d� ho�n t?t. C� th? x�y state machine v� snapshot tru?c, nhung kh�ng th? ho�n th�nh Phase 2B n?u chua c� engine foundation.

Ngo�i ph?m vi g?m chuy?n kho?n tr?c ti?p qua ng�n h�ng, n?p h? so tr?c ti?p cho co quan thu?/b?o hi?m, ch? k� s? ph�p l�, h?ch to�n k? to�n t? d?ng v� tr�nh t?o c�ng th?c t�y �.
