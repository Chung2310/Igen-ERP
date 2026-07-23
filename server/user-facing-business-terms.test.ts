import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const forbiddenCopy: Record<string, string[]> = {
  "src/components/common/ChatbotWidget.tsx": ["Khách hàng (CRM)", "pipeline", "Pipeline CRM"],
  "src/pages/Header.tsx": ["Omni-Inbox Chat"],
  "src/pages/LandingPage.tsx": ["Omni-Channel CRM", "Sales CRM & OmniChat", "tồn kho SKU", "CRM OmniChat", "sales CRM"],
  "src/pages/InventoryTab.tsx": ["SKU này", "dòng SKU", "sản phẩm SKU", ">SKU<"],
  "src/pages/DashboardTab.tsx": [">SKU:", " SKU</span>"],
  "src/components/inventory/ProductModal.tsx": ["Mã SKU", "Nhập mã SKU"],
  "src/components/inventory/ProductCatalogSection.tsx": ["mã SKU"],
  "src/components/inventory/ProductCard.tsx": [">SKU:"],
  "src/components/inventory/LowStockModal.tsx": [">SKU<"],
  "src/components/inventory/StockLogPanel.tsx": [">SKU:"],
  "src/components/inventory/AiForecastPanel.tsx": ["Theo dõi SKU", "SKU nào", ">SKU:"],
  "src/components/hr/KanbanTab.tsx": [">Kanban<", "{task.category || \"Onboarding\"}", "{editCategory || \"Onboarding\"}", "Ví dụ: Onboarding", "VD: Onboarding"],
  "src/components/hr/WorkflowTab.tsx": ["vd: Onboarding", "VD: Onboarding"],
  "src/pages/ChatTab.tsx": ["Kanban Task"],
};

test("user-facing business terms use plain Vietnamese", () => {
  for (const [file, phrases] of Object.entries(forbiddenCopy)) {
    const source = readFileSync(file, "utf8");
    for (const phrase of phrases) assert.equal(source.includes(phrase), false, `${file}: ${phrase}`);
  }
});

const additionalForbiddenCopy: Record<string, string[]> = {
  "src/components/hr/KanbanTab.tsx": [">Tasks<", "Ví dụ: backend, api, security"],
  "src/components/resource/FileExplorer.tsx": [">Send to chat<"],
  "src/pages/LandingPage.tsx": ["OmniChat Inbox", "OMNICHAT INBOX", "Facebook Graph API", "Zalo Business API"],
  "src/pages/InventoryTab.tsx": ["Đã import", "được import", "Không thể import"],
  "src/pages/SubmitProofPage.tsx": ["Đang tải tệp lên Cloudinary"],
  "src/pages/UserAdminTab.tsx": ["chỉnh sửa balance"],
  "src/pages/WalletTab.tsx": ["VietQR"],
  "src/modules/student-management/pages/Notifications/NotificationsPage.tsx": ["Mã VietQR", "SMTP Sender", "plain text"],
  "src/pages/super-admin/users/UserDetailPage.tsx": ["Lock account", "Unlock"],
};

test("additional technical labels are not shown to users", () => {
  for (const [file, phrases] of Object.entries(additionalForbiddenCopy)) {
    const source = readFileSync(file, "utf8");
    for (const phrase of phrases) assert.equal(source.includes(phrase), false, `${file}: ${phrase}`);
  }
});
