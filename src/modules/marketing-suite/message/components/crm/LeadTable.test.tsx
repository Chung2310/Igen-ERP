// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeadTable } from "./LeadTable";
import { crmService, type ActiveLeadIntakeProfile, type ExtendedLeadCard } from "../../services/crmService";
import type { LeadAccountOption } from "./leadSheetUtils";

vi.mock("../../../../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../services/crmService", () => ({
  crmService: {
    getActiveLeadIntakeProfiles: vi.fn(),
    getLeadPage: vi.fn(),
    getAllLeadRows: vi.fn(),
    updateLead: vi.fn(),
    createLead: vi.fn(),
    getLeadIntakeProfilesForAccount: vi.fn(),
    suggestLeadIntakeProfile: vi.fn(),
    saveAndActivateLeadIntakeProfile: vi.fn(),
    archiveLeadIntakeProfile: vi.fn(),
  },
}));

const accounts: LeadAccountOption[] = [
  { id: "fb-1", platform: "facebook", accountId: "page_spa_01", displayName: "Spa Hoa Hồng" },
  { id: "zalo-1", platform: "zalo", accountId: "zalo_01", displayName: "Zalo Tư Vấn" },
];

const activeProfiles: ActiveLeadIntakeProfile[] = [
  {
    id: "profile-1",
    platform: "facebook",
    accountId: "page_spa_01",
    version: 3,
    goal: "Tư vấn liệu trình chăm sóc da",
    completionMessage: "Cảm ơn chị đã để lại thông tin.",
    fields: [
      { key: "nhu_cau", label: "Dịch vụ quan tâm", question: "Chị quan tâm dịch vụ nào ạ?", type: "multi_select", required: true, options: ["Trị mụn", "Trẻ hóa da", "Tắm trắng"] },
      { key: "ngan_sach", label: "Ngân sách dự kiến", question: "Chị dự kiến ngân sách khoảng bao nhiêu ạ?", type: "currency", required: false, options: [] },
      { key: "dat_lich", label: "Xác nhận đặt lịch", question: "Chị muốn đặt lịch hẹn luôn không ạ?", type: "checkbox", required: false, options: [] },
    ],
  },
];

const sampleLead: ExtendedLeadCard = {
  id: "lead-1",
  customerName: "Nguyễn Minh Anh",
  phone: "0901234567",
  email: "minhanh@example.com",
  company: "",
  value: 5000000,
  avatar: "MA",
  productOfChoice: "Trị mụn",
  status: "warm",
  lastInteraction: "Quan tâm trị mụn",
  lastInteractionTime: "Vừa xong",
  sourcePlatform: "facebook",
  sourceAccountId: "page_spa_01",
  sourceConversationId: "conv-1",
  collectionStatus: "collecting",
  answers: {
    nhu_cau: "Trị mụn",
  },
  intakeFields: activeProfiles[0].fields,
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(crmService.getActiveLeadIntakeProfiles).mockResolvedValue(activeProfiles);
  vi.mocked(crmService.getLeadPage).mockResolvedValue({
    data: [sampleLead],
    total: 1,
    page: 1,
    limit: 25,
    totalPages: 1,
  });
  vi.mocked(crmService.getLeadIntakeProfilesForAccount).mockResolvedValue({
    profiles: [
      {
        _id: "profile-1",
        platform: "facebook",
        accountId: "page_spa_01",
        version: 3,
        status: "active",
        goal: "Tư vấn liệu trình chăm sóc da",
        completionMessage: "Cảm ơn chị.",
        fields: activeProfiles[0].fields,
      },
    ],
    fallbackProfiles: [],
  });
});

afterEach(() => {
  cleanup();
});

describe("LeadTable", () => {
  it("renders account worksheet tabs, custom chatbot columns, and avoids noisy empty cell placeholders", async () => {
    const onSelectAccountScope = vi.fn();
    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={onSelectAccountScope}
      />,
    );

    expect(await screen.findByText("Nguyễn Minh Anh")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Tất cả Lead/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Spa Hoa Hồng/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("columnheader", { name: /Dịch vụ quan tâm/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Ngân sách dự kiến/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Xác nhận đặt lịch/ })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /Email/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Doanh nghiệp/ })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Giá trị dự kiến/ })).toBeNull();
    expect(screen.queryByText(/Nhập dữ liệu/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Zalo Tư Vấn/ }));
    expect(onSelectAccountScope).toHaveBeenCalledWith("zalo", "zalo_01");
  });

  it("supports inline cell editing for text, multi-select popover, and 1-tap checkbox toggle", async () => {
    vi.mocked(crmService.updateLead).mockImplementation(async (_id, patch) => ({
      ...sampleLead,
      ...patch,
      answers: patch.answers ?? sampleLead.answers,
    }));

    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    // 1. Multi-select popover
    fireEvent.click(screen.getByRole("button", { name: /Sửa Dịch vụ quan tâm/ }));
    const popover = await screen.findByRole("dialog", { name: "Chỉnh sửa Dịch vụ quan tâm" });
    fireEvent.click(within(popover).getByLabelText("Trẻ hóa da"));
    fireEvent.click(within(popover).getByRole("button", { name: "Áp dụng" }));

    await waitFor(() => {
      expect(crmService.updateLead).toHaveBeenCalledWith("lead-1", {
        answers: { nhu_cau: "Trị mụn, Trẻ hóa da" },
      });
    });

    // 2. Checkbox 1-tap toggle
    fireEvent.click(screen.getByRole("button", { name: /^Xác nhận đặt lịch:/ }));
    await waitFor(() => {
      expect(crmService.updateLead).toHaveBeenCalledWith("lead-1", {
        answers: { nhu_cau: "Trị mụn, Trẻ hóa da", dat_lich: "Có" },
      });
    });

    // 3. Inline currency text edit + Enter commit
    fireEvent.click(screen.getByRole("button", { name: /Sửa Ngân sách dự kiến/ }));
    const currencyInput = screen.getByRole("textbox", { name: "Sửa Ngân sách dự kiến" });
    fireEvent.change(currencyInput, { target: { value: "12000000" } });
    fireEvent.keyDown(currencyInput, { key: "Enter" });

    await waitFor(() => {
      expect(crmService.updateLead).toHaveBeenCalledWith("lead-1", {
        answers: { nhu_cau: "Trị mụn, Trẻ hóa da", dat_lich: "Có", ngan_sach: "12000000" },
      });
    });
  });

  it("opens Column & Chatbot Builder to add a column and activate in one click", async () => {
    const onSelectAccountScope = vi.fn();
    vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mockResolvedValue({
      version: 4,
      status: "active",
      goal: "Tư vấn",
      completionMessage: "Cảm ơn",
      fields: [],
    });

    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={onSelectAccountScope}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    fireEvent.click(screen.getByRole("button", { name: "Thêm cột Bot" }));
    expect(await screen.findByText("Cấu hình cột Lead & câu hỏi Chatbot")).toBeTruthy();

    const newLabelInput = screen.getByRole("textbox", { name: "Tên cột 4" });
    fireEvent.change(newLabelInput, { target: { value: "Khung giờ gọi lại" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu & Áp dụng cho Chatbot" }));

    await waitFor(() => {
      expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "facebook",
          accountId: "page_spa_01",
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "khung_gio_goi_lai",
              label: "Khung giờ gọi lại",
            }),
          ]),
        }),
      );
    });
    expect(onSelectAccountScope).toHaveBeenCalledWith("facebook", "page_spa_01");
  });

  it("omits bottom quick-add row, opens detail drawer, edits lead, and confirms deletion with ConfirmDialog", async () => {
    const deleteLead = vi.fn().mockResolvedValue(undefined);
    vi.mocked(crmService.updateLead).mockResolvedValue({
      ...sampleLead,
      company: "Công ty ABC",
    });

    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={deleteLead}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    expect(screen.queryByRole("textbox", { name: "Thêm nhanh dòng Lead mới" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thêm dòng" })).toBeNull();

    // Open Detail Drawer & save
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Minh Anh" }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Thông tin Lead theo bộ cột của bạn")).toBeTruthy();
    fireEvent.change(within(drawer).getByLabelText("Doanh nghiệp"), { target: { value: "Công ty ABC" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => {
      expect(crmService.updateLead).toHaveBeenCalledWith(
        "lead-1",
        expect.objectContaining({ company: "Công ty ABC" }),
      );
    });

    // Delete via ConfirmDialog
    fireEvent.click(screen.getByRole("button", { name: "Xóa Nguyễn Minh Anh" }));
    expect(await screen.findByText("Xóa Lead khỏi bảng?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa Lead" }));

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith("lead-1"));
  });

  it("allows adding a company-wide column directly from table header even without connected social accounts", async () => {
    vi.mocked(crmService.getActiveLeadIntakeProfiles).mockResolvedValue([]);
    vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mockResolvedValue({
      version: 1,
      status: "active",
      goal: "Thu thập thông tin khách hàng tiềm năng",
      completionMessage: "Cảm ơn",
      fields: [],
    });

    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="all"
        companyCode="SPA01"
        branchId="main"
        accounts={[]}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");
    const configBtn = screen.getByRole("button", { name: "Cấu hình cột & Chatbot" });
    expect(configBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Thêm cột" }));
    expect(await screen.findByText("Thêm cột mới vào Lead Sheet")).toBeTruthy();
    const labelInput = screen.getByLabelText("Tên cột mới");
    const modalForm = labelInput.closest("form")!;
    fireEvent.change(labelInput, { target: { value: "Nguồn khách hàng" } });
    fireEvent.click(within(modalForm).getByRole("button", { name: "Thêm cột" }));

    await waitFor(() => {
      expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              key: "nguon_khach_hang",
              label: "Nguồn khách hàng",
            }),
          ]),
        }),
      );
    });
    expect(vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mock.calls[0][0].platform).toBeUndefined();
  });

  it("allows deleting a custom column directly from its column header", async () => {
    vi.mocked(crmService.saveAndActivateLeadIntakeProfile).mockResolvedValue({
      version: 4,
      status: "active",
      goal: "Tư vấn liệu trình chăm sóc da",
      completionMessage: "Cảm ơn",
      fields: [],
    });

    render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    fireEvent.click(screen.getByRole("button", { name: "Xóa cột Dịch vụ quan tâm" }));

    expect(await screen.findByText("Xóa cột khỏi Lead Sheet?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa cột" }));

    await waitFor(() => {
      expect(crmService.saveAndActivateLeadIntakeProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "facebook",
          accountId: "page_spa_01",
          fields: expect.not.arrayContaining([
            expect.objectContaining({ key: "nhu_cau" }),
          ]),
        }),
      );
    });
  });

  it("filters by custom fields, pins multiple conditions, sorts by any field, and clears filters", async () => {
    const setSearchQuery = vi.fn();

    render(
      <LeadTable
        searchQuery="Minh Anh"
        setSearchQuery={setSearchQuery}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="facebook"
        accountId="page_spa_01"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    // 1. Filter by select-based custom column ("Dịch vụ quan tâm")
    fireEvent.click(screen.getByRole("button", { name: "Chọn trường thông tin để lọc" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Dịch vụ quan tâm"));

    fireEvent.click(screen.getByRole("button", { name: "Giá trị lọc Dịch vụ quan tâm" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Trị mụn"));

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fieldFilters: [{ key: "answers.nhu_cau", value: "Trị mụn", mode: "contains" }],
        }),
      );
    });

    // 2. Pin the first filter, then add a 2nd custom column filter ("Ngân sách dự kiến")
    fireEvent.click(screen.getByRole("button", { name: "Ghim điều kiện lọc" }));
    expect(screen.getByLabelText("Bỏ lọc Dịch vụ quan tâm")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chọn trường thông tin để lọc" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Ngân sách dự kiến"));

    fireEvent.change(screen.getByRole("textbox", { name: "Giá trị lọc Ngân sách dự kiến" }), {
      target: { value: "5000000" },
    });

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fieldFilters: [
            { key: "answers.nhu_cau", value: "Trị mụn", mode: "contains" },
            { key: "answers.ngan_sach", value: "5000000", mode: "contains" },
          ],
        }),
      );
    });

    // 3. Sort by custom column via toolbar Sort dropdown
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp danh sách Lead theo trường" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Dịch vụ quan tâm (A → Z)"));

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: "answers.nhu_cau:asc",
        }),
      );
    });

    // 4. Clear all filters & sort via "Xóa bộ lọc"
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));

    expect(setSearchQuery).toHaveBeenCalledWith("");
    expect(screen.queryByLabelText("Bỏ lọc Dịch vụ quan tâm")).toBeNull();

    await waitFor(() => {
      const lastCall = vi.mocked(crmService.getLeadPage).mock.calls.at(-1)?.[0];
      expect(lastCall?.fieldFilters).toBeUndefined();
      expect(lastCall?.sort).toBe("updatedAt:desc");
    });
  });
});
