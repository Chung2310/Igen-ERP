/**
 * ================================================================
 * iGen ERP — Firestore Permission Test Suite v2
 * ================================================================
 * Tests Firestore security rules against Cloud Firestore (production)
 * using the Firebase REST API (Identity Toolkit + Firestore REST).
 *
 * Key fixes vs v1:
 *  - fsCreate() uses POST (createDocument) to trigger Firestore 'create' rule
 *  - fsUpdate() uses PATCH only on existing docs to trigger 'update' rule
 *  - Retry delay added after account creation (token propagation)
 *
 * Run: node scratch/permission_test.mjs
 * ================================================================
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAfZW5tAwUsJPGbOdC4u-78EoSVB14XSy0",
  projectId: "igen-25811",
};

const SUPERADMIN = { email: "superadmin@igen.com", password: "superadmin123" };

// ── ANSI colours ───────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  dim:    "\x1b[2m",
};

// ── Test counters ──────────────────────────────────────────────
let passed = 0, failed = 0;

function log(icon, label, detail = "") {
  console.log(`  ${icon}  ${label}${detail ? C.dim + "  " + detail + C.reset : ""}`);
}
function pass(label, detail = "") { passed++; log(C.green + "✓" + C.reset, C.green + label + C.reset, detail); }
function fail(label, detail = "") { failed++; log(C.red   + "✗" + C.reset, C.red   + label + C.reset, detail); }
function section(title) { console.log(`\n${C.bold}${C.cyan}━━ ${title} ━━${C.reset}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Firebase Auth (REST) ───────────────────────────────────────
async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`;
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`signIn failed for ${email}: ${data.error?.message}`);
  return { idToken: data.idToken, uid: data.localId };
}

async function signUp(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`;
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`signUp failed for ${email}: ${data.error?.message}`);
  return { idToken: data.idToken, uid: data.localId };
}

// ── Firestore REST helpers ─────────────────────────────────────
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if      (typeof v === "string")  fields[k] = { stringValue: v };
    else if (typeof v === "number")  fields[k] = { integerValue: String(v) };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (v instanceof Date)      fields[k] = { timestampValue: v.toISOString() };
    else                             fields[k] = { stringValue: String(v) };
  }
  return fields;
}

/** GET document — returns HTTP status */
async function fsGet(path, idToken) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  return res.status;
}

/**
 * CREATE document (POST with documentId) — triggers Firestore 'create' rule.
 * Returns HTTP status.
 */
async function fsCreate(collection, docId, data, idToken) {
  const url = `${FS_BASE}/${collection}?documentId=${encodeURIComponent(docId)}`;
  const res  = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return res.status;
}

/**
 * UPDATE document (PATCH) — triggers Firestore 'update' rule.
 * The document must already exist.
 * Returns HTTP status.
 */
async function fsUpdate(path, data, idToken) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    method:  "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return res.status;
}

/** DELETE document — returns HTTP status */
async function fsDelete(path, idToken) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    method:  "DELETE",
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  return res.status;
}

// ── expect helpers ─────────────────────────────────────────────
function expectAllow(label, status, allowedStatuses = [200]) {
  if (allowedStatuses.includes(status)) pass(label, `HTTP ${status}`);
  else fail(label, `Expected allow, got HTTP ${status}`);
}
function expectDeny(label, status) {
  if (status === 403) pass(label, `HTTP 403 — denied correctly`);
  else fail(label, `Expected 403 deny, got HTTP ${status}`);
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║    iGen ERP — Firestore Permission Test Suite v2    ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}  Target: ${FIREBASE_CONFIG.projectId} (Cloud Firestore Production)${C.reset}\n`);

  // ── 1. Superadmin session ──────────────────────────────────
  section("1. Thiết lập phiên Superadmin");
  let sa;
  try {
    sa = await signIn(SUPERADMIN.email, SUPERADMIN.password);
    pass("Đăng nhập Superadmin thành công", sa.uid);
  } catch (e) {
    fail("Đăng nhập Superadmin thất bại", e.message);
    process.exit(1);
  }

  // ── 2. Seed tài khoản test ────────────────────────────────
  section("2. Chuẩn bị tài khoản test");
  const ts           = Date.now();
  const ADMIN_EMAIL  = `test_admin_${ts}@testco.vn`;
  const MGR_EMAIL    = `test_mgr_${ts}@testco.vn`;
  const USER_EMAIL   = `test_user_${ts}@testco.vn`;
  const TEST_PASS    = "Test123456!";
  const COMPANY_CODE = `TC${ts}`.slice(0, 10);

  let admin, mgr, user;
  try {
    admin = await signUp(ADMIN_EMAIL, TEST_PASS);
    mgr   = await signUp(MGR_EMAIL,   TEST_PASS);
    user  = await signUp(USER_EMAIL,  TEST_PASS);
    pass("Tạo 3 tài khoản Firebase Auth thành công",
      `admin:${admin.uid.slice(0,8)}, mgr:${mgr.uid.slice(0,8)}, user:${user.uid.slice(0,8)}`);
  } catch (e) {
    fail("Tạo tài khoản thất bại", e.message);
    process.exit(1);
  }

  // Nhỏ delay để Firebase Auth propagate
  await sleep(1000);

  const now = new Date().toISOString();

  // Seed hồ sơ bằng SUPERADMIN token (create rule: isSuperAdmin() → cho phép)
  // Dùng fsCreate (POST) để kích hoạt Firestore create rule đúng cách
  const adminDoc = { uid: admin.uid, email: ADMIN_EMAIL, displayName: "Test Admin",
    role: "admin", companyCode: COMPANY_CODE, companyName: "Test Corp",
    createdAt: now, level: 1, status: "offline" };
  const mgrDoc   = { uid: mgr.uid,   email: MGR_EMAIL,   displayName: "Test Manager",
    role: "manager", companyCode: COMPANY_CODE, companyName: "Test Corp",
    createdAt: now, level: 3, parentId: admin.uid, status: "offline" };
  const userDoc  = { uid: user.uid,  email: USER_EMAIL,  displayName: "Test User",
    role: "user", companyCode: COMPANY_CODE, companyName: "Test Corp",
    createdAt: now, level: 4, parentId: mgr.uid, status: "offline" };

  const s1 = await fsCreate("users", admin.uid, adminDoc, sa.idToken);
  const s2 = await fsCreate("users", mgr.uid,   mgrDoc,   sa.idToken);
  const s3 = await fsCreate("users", user.uid,  userDoc,  sa.idToken);

  if ([s1, s2, s3].every(s => [200, 201].includes(s))) {
    pass("Ghi hồ sơ Firestore cho admin/mgr/user", `HTTP ${s1}/${s2}/${s3}`);
  } else {
    fail("Ghi hồ sơ thất bại", `HTTP ${s1}/${s2}/${s3} — test sẽ bị ảnh hưởng!`);
  }

  // Seed marketing content (dùng fsCreate)
  const MC_ADMIN_ID = `mc_admin_${ts}`;
  const MC_USER_ID  = `mc_user_${ts}`;
  const mcAdmin = { id: MC_ADMIN_ID, title: "Admin Content", channel: "Facebook",
    contentType: "Bài viết", status: "pending", bodyText: "body", generatedAt: now,
    authorUid: admin.uid, companyCode: COMPANY_CODE };
  const mcUser = { id: MC_USER_ID, title: "User Content", channel: "Instagram",
    contentType: "Bài viết", status: "draft", bodyText: "body", generatedAt: now,
    authorUid: user.uid, companyCode: COMPANY_CODE };

  await fsCreate("marketingContents", MC_ADMIN_ID, mcAdmin, sa.idToken);
  await fsCreate("marketingContents", MC_USER_ID,  mcUser,  sa.idToken);
  pass("Seed marketing content mẫu thành công");

  // Nhỏ delay để Firestore consistency
  await sleep(1500);

  // ══════════════════════════════════════════════════════════════
  // SECTION 3: /users READ
  // ══════════════════════════════════════════════════════════════
  section("3. /users — Kiểm tra quyền đọc (READ)");

  expectAllow("Superadmin đọc hồ sơ Admin",
    await fsGet(`users/${admin.uid}`, sa.idToken));

  expectAllow("Admin đọc hồ sơ của chính mình",
    await fsGet(`users/${admin.uid}`, admin.idToken));

  expectAllow("Admin đọc hồ sơ User cùng công ty",
    await fsGet(`users/${user.uid}`, admin.idToken));

  expectAllow("User đọc hồ sơ của chính mình",
    await fsGet(`users/${user.uid}`, user.idToken));

  expectAllow("User đọc hồ sơ Manager cùng công ty",
    await fsGet(`users/${mgr.uid}`, user.idToken));

  expectDeny("User bị chặn đọc hồ sơ Superadmin (khác công ty)",
    await fsGet(`users/${sa.uid}`, user.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 4: /users WRITE
  // ══════════════════════════════════════════════════════════════
  section("4. /users — Kiểm tra quyền ghi (WRITE)");

  // Admin creates a user within same company (fsCreate → POST → 'create' rule)
  const NEW_EMP_ID  = `emp_${ts}`;
  const NEW_MGR2_ID = `mgr2_${ts}`;
  const newEmpDoc = { uid: NEW_EMP_ID, email: `emp_${ts}@testco.vn`, displayName: "New Emp",
    role: "user", companyCode: COMPANY_CODE, companyName: "Test Corp",
    createdAt: now, level: 5, parentId: mgr.uid, status: "offline" };
  const newMgr2Doc = { ...newEmpDoc, uid: NEW_MGR2_ID, email: `mgr2_${ts}@testco.vn`,
    displayName: "New Mgr2", role: "manager", level: 4 };
  const newAdminDoc = { ...newEmpDoc, uid: `adm_${ts}`, email: `adm_${ts}@testco.vn`,
    displayName: "New Admin", role: "admin", level: 1, parentId: undefined };

  expectAllow("Admin tạo user mới trong cùng công ty",
    await fsCreate("users", NEW_EMP_ID, newEmpDoc, admin.idToken));

  expectAllow("Admin tạo manager mới trong cùng công ty",
    await fsCreate("users", NEW_MGR2_ID, newMgr2Doc, admin.idToken));

  expectDeny("Admin bị chặn tạo tài khoản Admin mới cùng cấp",
    await fsCreate("users", `adm_${ts}`, newAdminDoc, admin.idToken));

  // Manager updates user (role unchanged) — fsUpdate (PATCH)
  expectAllow("Manager cập nhật thông tin User cùng công ty (không đổi role)",
    await fsUpdate(`users/${NEW_EMP_ID}`, { ...newEmpDoc, jobTitle: "Dev" }, mgr.idToken));

  // Manager tries to change role of user
  expectDeny("Manager bị chặn thay đổi role của User",
    await fsUpdate(`users/${NEW_EMP_ID}`, { ...newEmpDoc, role: "manager" }, mgr.idToken));

  // Manager tries to touch admin's profile
  expectDeny("Manager bị chặn chỉnh sửa hồ sơ Admin",
    await fsUpdate(`users/${admin.uid}`, { ...adminDoc, jobTitle: "Hacked" }, mgr.idToken));

  // User edits someone else
  expectDeny("User bị chặn chỉnh sửa hồ sơ người khác",
    await fsUpdate(`users/${mgr.uid}`, { ...mgrDoc, jobTitle: "Hacker" }, user.idToken));

  // User updates own profile (role unchanged)
  expectAllow("User cập nhật hồ sơ của chính mình (không đổi role)",
    await fsUpdate(`users/${user.uid}`, { ...userDoc, displayName: "Updated" }, user.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 5: /users DELETE
  // ══════════════════════════════════════════════════════════════
  section("5. /users — Kiểm tra quyền xóa (DELETE)");

  expectDeny("User bị chặn tự xóa hồ sơ của mình",
    await fsDelete(`users/${user.uid}`, user.idToken));

  expectAllow("Manager xóa User trong cùng công ty",
    await fsDelete(`users/${NEW_EMP_ID}`, mgr.idToken));

  expectDeny("Manager bị chặn xóa tài khoản Manager khác cùng công ty",
    await fsDelete(`users/${NEW_MGR2_ID}`, mgr.idToken));

  expectDeny("Manager bị chặn xóa tài khoản Admin cùng công ty",
    await fsDelete(`users/${admin.uid}`, mgr.idToken));

  expectAllow("Admin xóa Manager trong cùng công ty",
    await fsDelete(`users/${NEW_MGR2_ID}`, admin.idToken));

  expectDeny("Admin bị chặn xóa tài khoản Superadmin",
    await fsDelete(`users/${sa.uid}`, admin.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 6: /marketingContents READ
  // ══════════════════════════════════════════════════════════════
  section("6. /marketingContents — Kiểm tra quyền đọc (READ)");

  expectAllow("Admin đọc content của User cùng công ty",
    await fsGet(`marketingContents/${MC_USER_ID}`, admin.idToken));

  expectAllow("Manager đọc được content (isManager() = true)",
    await fsGet(`marketingContents/${MC_ADMIN_ID}`, mgr.idToken));

  expectAllow("User đọc content của chính mình",
    await fsGet(`marketingContents/${MC_USER_ID}`, user.idToken));

  expectDeny("User bị chặn đọc content của Admin (authorUid khác)",
    await fsGet(`marketingContents/${MC_ADMIN_ID}`, user.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 7: /marketingContents WRITE
  // ══════════════════════════════════════════════════════════════
  section("7. /marketingContents — Kiểm tra quyền ghi (CREATE/UPDATE/DELETE)");

  const MC_NEW_USER = `mc_new_user_${ts}`;
  const MC_NEW_MGR  = `mc_new_mgr_${ts}`;
  const MC_SPOOF    = `mc_spoof_${ts}`;

  const newMcUser = { id: MC_NEW_USER, title: "User New", channel: "Facebook",
    contentType: "Bài viết", status: "draft", bodyText: "test", generatedAt: now,
    authorUid: user.uid, companyCode: COMPANY_CODE };
  const newMcMgr = { ...newMcUser, id: MC_NEW_MGR, authorUid: mgr.uid };
  const spoofMc  = { ...newMcUser, id: MC_SPOOF,   authorUid: admin.uid };

  expectAllow("User tạo content của chính mình",
    await fsCreate("marketingContents", MC_NEW_USER, newMcUser, user.idToken));

  expectAllow("Manager tạo content của chính mình",
    await fsCreate("marketingContents", MC_NEW_MGR, newMcMgr, mgr.idToken));

  expectDeny("User bị chặn tạo content giả mạo authorUid người khác",
    await fsCreate("marketingContents", MC_SPOOF, spoofMc, user.idToken));

  // User tries to self-approve (draft→approved) — fsUpdate
  expectDeny("User bị chặn tự duyệt content của mình (draft→approved)",
    await fsUpdate(`marketingContents/${MC_NEW_USER}`, { ...newMcUser, status: "approved" }, user.idToken));

  // User submits for approval (draft→pending) — fsUpdate
  const mcNewUserPending = { ...newMcUser, status: "pending" };
  expectAllow("User gửi content để duyệt (draft→pending)",
    await fsUpdate(`marketingContents/${MC_NEW_USER}`, mcNewUserPending, user.idToken));

  // Admin approves (pending→approved) — fsUpdate
  expectAllow("Admin duyệt content (pending→approved)",
    await fsUpdate(`marketingContents/${MC_NEW_USER}`, { ...newMcUser, status: "approved" }, admin.idToken));

  // Manager tries to approve — the content is now "approved" owned by user → manager not owner → deny
  expectDeny("Manager bị chặn duyệt content người khác (không phải chủ)",
    await fsUpdate(`marketingContents/${MC_NEW_USER}`, { ...newMcUser, status: "scheduled" }, mgr.idToken));

  // User deletes own content
  expectAllow("User xóa content của chính mình",
    await fsDelete(`marketingContents/${MC_NEW_MGR}`, mgr.idToken));

  // User tries to delete admin's content
  expectDeny("User bị chặn xóa content của Admin",
    await fsDelete(`marketingContents/${MC_ADMIN_ID}`, user.idToken));

  // Admin deletes anyone's content in company
  expectAllow("Admin xóa content của người khác trong công ty",
    await fsDelete(`marketingContents/${MC_USER_ID}`, admin.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 8: /companies
  // ══════════════════════════════════════════════════════════════
  section("8. /companies — Kiểm tra quyền truy cập");

  const SA_CO_ID = `sa_co_${ts}`;

  // Authenticated user reads companies (might 404 if no doc — that's not 403)
  expectAllow("User đọc companies (xác thực hợp lệ)",
    await fsGet(`companies/${COMPANY_CODE}`, user.idToken), [200, 404]);

  // Admin tries to write companies
  expectDeny("Admin bị chặn tạo/sửa bản ghi companies",
    await fsCreate("companies", `hack_co_${ts}`, { code: "HACK", name: "Hacker" }, admin.idToken));

  // Superadmin writes companies
  expectAllow("Superadmin tạo bản ghi companies",
    await fsCreate("companies", SA_CO_ID, { code: SA_CO_ID, name: "SA Test Corp", ownerEmail: "sa@test.com", createdAt: now }, sa.idToken),
    [200, 201]);

  // ══════════════════════════════════════════════════════════════
  // SECTION 8.5: /kanbanTasks
  // ══════════════════════════════════════════════════════════════
  section("8.5. /kanbanTasks — Kiểm tra quyền truy cập (READ/WRITE)");

  const TASK_ADMIN_ID = `task_admin_${ts}`;
  const TASK_USER_ID  = `task_user_${ts}`;
  
  const taskAdmin = { 
    id: TASK_ADMIN_ID, 
    title: "Admin Task", 
    assigneeUid: user.uid,
    assignee: "Test User",
    assigneeAvatar: "👨‍💻",
    dueDate: "Hôm nay",
    priority: "Cao",
    status: "todo",
    category: "Tuyển dụng",
    companyCode: COMPANY_CODE,
    creatorUid: admin.uid,
    createdAt: now
  };

  const taskUser = { 
    id: TASK_USER_ID, 
    title: "User Task", 
    assigneeUid: mgr.uid,
    assignee: "Test Manager",
    assigneeAvatar: "👩‍💼",
    dueDate: "Ngày mai",
    priority: "Thấp",
    status: "doing",
    category: "Văn hóa",
    companyCode: COMPANY_CODE,
    creatorUid: user.uid,
    createdAt: now
  };

  // 1. Admin creates task (allow)
  expectAllow("Admin tạo công việc thành công cùng công ty",
    await fsCreate("kanbanTasks", TASK_ADMIN_ID, taskAdmin, admin.idToken));

  // 2. User creates task (allow)
  expectAllow("User tạo công việc thành công cùng công ty",
    await fsCreate("kanbanTasks", TASK_USER_ID, taskUser, user.idToken));

  // 3. User reads task (same company)
  expectAllow("User đọc công việc cùng công ty",
    await fsGet(`kanbanTasks/${TASK_ADMIN_ID}`, user.idToken));

  // 4. User updates task completely (allow)
  expectAllow("User cập nhật toàn bộ thông tin công việc thành công",
    await fsUpdate(`kanbanTasks/${TASK_ADMIN_ID}`, { ...taskAdmin, title: "Updated by User", priority: "Thấp" }, user.idToken));

  // 5. User tries to delete task (deny)
  expectDeny("User bị chặn xóa công việc",
    await fsDelete(`kanbanTasks/${TASK_ADMIN_ID}`, user.idToken));

  // 6. Admin deletes task (allow)
  expectAllow("Admin xóa công việc thành công",
    await fsDelete(`kanbanTasks/${TASK_ADMIN_ID}`, admin.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 8.6: /projects
  // ══════════════════════════════════════════════════════════════
  section("8.6. /projects — Kiểm tra quyền truy cập (READ/WRITE)");

  const PROJ_ADMIN_ID = `proj_admin_${ts}`;
  const PROJ_USER_ID  = `proj_user_${ts}`;

  const projAdmin = {
    id: PROJ_ADMIN_ID,
    name: "Admin Project",
    companyCode: COMPANY_CODE,
    creatorUid: admin.uid,
    createdAt: now
  };

  const projUser = {
    id: PROJ_USER_ID,
    name: "User Project",
    companyCode: COMPANY_CODE,
    creatorUid: user.uid,
    createdAt: now
  };

  // 1. User creates project (allow)
  expectAllow("User tạo dự án thành công cùng công ty",
    await fsCreate("projects", PROJ_USER_ID, projUser, user.idToken));

  // 2. Admin creates project (allow)
  expectAllow("Admin tạo dự án thành công cùng công ty",
    await fsCreate("projects", PROJ_ADMIN_ID, projAdmin, admin.idToken));

  // 3. User updates project (allow)
  expectAllow("User sửa tên dự án thành công cùng công ty",
    await fsUpdate(`projects/${PROJ_ADMIN_ID}`, { ...projAdmin, name: "Admin Project Updated" }, user.idToken));

  // 4. User tries to delete project (deny)
  expectDeny("User bị chặn xóa dự án",
    await fsDelete(`projects/${PROJ_ADMIN_ID}`, user.idToken));

  // 5. Admin deletes project (allow)
  expectAllow("Admin xóa dự án thành công",
    await fsDelete(`projects/${PROJ_ADMIN_ID}`, admin.idToken));

  // ══════════════════════════════════════════════════════════════
  // SECTION 9: Unauthenticated
  // ══════════════════════════════════════════════════════════════
  section("9. Kiểm tra truy cập không xác thực (Unauthenticated)");

  expectDeny("Không xác thực bị chặn đọc /users",
    await fsGet(`users/${admin.uid}`, null));

  expectDeny("Không xác thực bị chặn đọc /marketingContents",
    await fsGet(`marketingContents/${MC_ADMIN_ID}`, null));

  // ══════════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════════
  section("10. Dọn dẹp dữ liệu test");

  const cleanups = [
    `users/${admin.uid}`, `users/${mgr.uid}`, `users/${user.uid}`,
    `users/${NEW_MGR2_ID}`,
    `marketingContents/${MC_ADMIN_ID}`, `marketingContents/${MC_NEW_USER}`,
    `marketingContents/${MC_NEW_MGR}`,  `marketingContents/${MC_SPOOF}`,
    `companies/${SA_CO_ID}`,
    `kanbanTasks/${TASK_ADMIN_ID}`, `kanbanTasks/${TASK_USER_ID}`,
    `projects/${PROJ_ADMIN_ID}`, `projects/${PROJ_USER_ID}`
  ];
  await Promise.all(cleanups.map(p => fsDelete(p, sa.idToken).catch(() => {})));
  console.log(`\n  ${C.dim}Đã xóa dữ liệu test khỏi Firestore.${C.reset}`);

  // ── Summary ────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${C.bold}╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║         KẾT QUẢ TỔNG HỢP        ║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.green}Passed:${C.reset} ${passed} / ${total}`);
  console.log(`  ${C.red}Failed:${C.reset} ${failed} / ${total}`);
  console.log(`  ${failed === 0
    ? C.green + "✅ Tất cả test đã PASS!"
    : C.red   + "❌ Có test FAIL — cần kiểm tra lại rules!"}${C.reset}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n${C.red}Fatal error:${C.reset}`, e.message);
  process.exit(1);
});
