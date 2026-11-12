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

  it("uses multi-condition Bộ lọc popover scoped to visible columns, sorts, and clears via Xóa bộ lọc", async () => {
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

    // 1. Open Bộ lọc popover — condition 1 appears immediately, no "+ Ghim lọc" step, hidden columns are excluded
    fireEvent.click(screen.getByRole("button", { name: /Bộ lọc/ }));
    const popover = screen.getByRole("dialog", { name: "Lọc theo cột hiển thị" });

    fireEvent.click(within(popover).getByRole("button", { name: "Trường lọc 1" }));
    const colListbox = screen.getByRole("listbox");
    expect(within(colListbox).queryByText("Email")).toBeNull();
    expect(within(colListbox).queryByText("Doanh nghiệp")).toBeNull();
    expect(within(colListbox).queryByText("Trạng thái chốt")).toBeNull();
    fireEvent.click(within(colListbox).getByText("Dịch vụ quan tâm"));

    fireEvent.click(within(popover).getByRole("button", { name: "Giá trị lọc Dịch vụ quan tâm" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Trị mụn"));

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fieldFilters: [{ key: "answers.nhu_cau", value: "Trị mụn", mode: "contains" }],
        }),
      );
    });

    // 2. Add condition 2 inside the same popover ("Ngân sách dự kiến")
    fireEvent.click(within(popover).getByRole("button", { name: "Thêm điều kiện" }));
    fireEvent.click(within(popover).getByRole("button", { name: "Trường lọc 2" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Ngân sách dự kiến"));

    fireEvent.change(within(popover).getByRole("textbox", { name: "Giá trị lọc Ngân sách dự kiến" }), {
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

    // Close popover via "Xong" -> badge count and removable chips are visible
    fireEvent.click(within(popover).getByRole("button", { name: "Xong" }));
    expect(screen.getByRole("button", { name: /Bộ lọc/ }).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Bỏ lọc Dịch vụ quan tâm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bỏ lọc Ngân sách dự kiến" })).toBeTruthy();

    // Remove condition 1 chip directly
    fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc Dịch vụ quan tâm" }));
    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fieldFilters: [{ key: "answers.ngan_sach", value: "5000000", mode: "contains" }],
        }),
      );
    });

    // 3. Sort by visible custom column (hidden system columns excluded)
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp danh sách Lead theo trường" }));
    const sortListbox = screen.getByRole("listbox");
    expect(within(sortListbox).queryByText("Email (A → Z)")).toBeNull();
    expect(within(sortListbox).queryByText("Trạng thái chốt (A → Z)")).toBeNull();
    fireEvent.click(within(sortListbox).getByText("Dịch vụ quan tâm (A → Z)"));

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort: "answers.nhu_cau:asc",
        }),
      );
    });

    // 4. Clear all search, filters, chips & sort via "Xóa bộ lọc"
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));

    expect(setSearchQuery).toHaveBeenCalledWith("");
    expect(screen.queryByRole("button", { name: "Bỏ lọc Ngân sách dự kiến" })).toBeNull();

    await waitFor(() => {
      const lastCall = vi.mocked(crmService.getLeadPage).mock.calls.at(-1)?.[0];
      expect(lastCall?.fieldFilters).toBeUndefined();
      expect(lastCall?.sort).toBe("updatedAt:desc");
    });
  });

  it("deduplicates cross-channel columns and updates Bộ lọc / Sắp xếp when toggling Cột hiển thị", async () => {
    vi.mocked(crmService.getActiveLeadIntakeProfiles).mockResolvedValue([
      ...activeProfiles,
      {
        id: "profile-zalo",
        platform: "zalo",
        accountId: "zalo_01",
        version: 1,
        goal: "Tư vấn Zalo",
        completionMessage: "Cảm ơn!",
        fields: [
          { key: "dich_vu", label: "Dịch vụ quan tâm", question: "Bạn cần dịch vụ gì?", type: "single_select", required: false, options: ["Gội đầu dưỡng sinh"] },
        ],
      },
    ]);

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
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    // On "Tất cả Lead", duplicate column label across Facebook & Zalo appears only ONCE in Sort & Filter
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp danh sách Lead theo trường" }));
    const initialSortListbox = screen.getByRole("listbox");
    expect(within(initialSortListbox).getAllByText("Dịch vụ quan tâm (A → Z)")).toHaveLength(1);
    expect(within(initialSortListbox).queryByText("Trạng thái chốt (A → Z)")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });

    // Enable hidden system column "Trạng thái chốt" -> immediately available in Bộ lọc & Sắp xếp
    fireEvent.click(screen.getByRole("button", { name: /Cột hiển thị/ }));
    const colMenu = screen.getByRole("menu", { name: "Tùy chỉnh hiển thị cột Sheet" });
    fireEvent.click(within(colMenu).getByLabelText("Trạng thái chốt"));
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: /Bộ lọc/ }));
    const popover = screen.getByRole("dialog", { name: "Lọc theo cột hiển thị" });
    fireEvent.click(within(popover).getByRole("button", { name: "Trường lọc 1" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Trạng thái chốt"));
    fireEvent.click(within(popover).getByRole("button", { name: "Giá trị lọc Trạng thái chốt" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Đã chốt"));

    await waitFor(() => {
      expect(crmService.getLeadPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fieldFilters: [{ key: "status", value: "won", mode: "exact" }],
        }),
      );
    });
    fireEvent.click(within(popover).getByRole("button", { name: "Xong" }));

    // Turn off "Trạng thái chốt" again -> active filter on hidden column is cleared cleanly
    fireEvent.click(screen.getByRole("button", { name: /Cột hiển thị/ }));
    fireEvent.click(within(screen.getByRole("menu", { name: "Tùy chỉnh hiển thị cột Sheet" })).getByLabelText("Trạng thái chốt"));

    await waitFor(() => {
      const lastCall = vi.mocked(crmService.getLeadPage).mock.calls.at(-1)?.[0];
      expect(lastCall?.fieldFilters).toBeUndefined();
    });
    expect(screen.queryByRole("button", { name: "Bỏ lọc Trạng thái chốt" })).toBeNull();
  });

  it("exposes visible horizontal scrollbar, scroll buttons, and centered empty state when many columns overflow", async () => {
    vi.mocked(crmService.getLeadPage).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 1,
    });

    const { container } = render(
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
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Chưa có dữ liệu Lead");

    // Empty state sits outside the horizontally overflowing <table> so it remains viewport-centered
    const emptyHeading = screen.getByRole("heading", { name: "Chưa có dữ liệu Lead" });
    expect(emptyHeading.closest("table")).toBeNull();

    // Grid wrapper uses visible-scrollbar + overflow-auto + border-separate so sticky borders & scrollbar remain visible
    const scrollWrapper = container.querySelector(".visible-scrollbar.overflow-auto") as HTMLDivElement | null;
    expect(scrollWrapper).not.toBeNull();
    expect(within(scrollWrapper!).getByRole("table").className).toContain("border-separate");

    // Turn on many system columns
    fireEvent.click(screen.getByRole("button", { name: /Cột hiển thị/ }));
    const colMenu = screen.getByRole("menu", { name: "Tùy chỉnh hiển thị cột Sheet" });
    for (const label of ["Số điện thoại", "Kênh / Tài khoản", "Tình trạng Bot", "Trạng thái chốt", "Giá trị dự kiến", "Email", "Doanh nghiệp", "Cập nhật"]) {
      fireEvent.click(within(colMenu).getByLabelText(label));
    }
    fireEvent.keyDown(document, { key: "Escape" });

    // All columns exist in the table header without truncation of the column list
    for (const label of ["Số điện thoại", "Kênh / Tài khoản", "Tình trạng Bot", "Trạng thái chốt", "Email", "Doanh nghiệp", "Cập nhật"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(label) })).toBeTruthy();
    }

    // Simulate horizontal overflow and verify scroll arrows appear & pan horizontally
    Object.defineProperty(scrollWrapper!, "clientWidth", { value: 900, configurable: true });
    Object.defineProperty(scrollWrapper!, "scrollWidth", { value: 1850, configurable: true });
    Object.defineProperty(scrollWrapper!, "scrollLeft", { value: 0, writable: true, configurable: true });
    fireEvent.scroll(scrollWrapper!);

    const scrollRightBtn = await screen.findByRole("button", { name: "Cuộn bảng sang phải" });
    const scrollLeftBtn = screen.getByRole("button", { name: "Cuộn bảng sang trái" });
    expect((scrollLeftBtn as HTMLButtonElement).disabled).toBe(true);
    expect((scrollRightBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(scrollRightBtn);
    expect(scrollWrapper!.scrollLeft).toBeGreaterThan(0);
  });

  it("bounds table viewport into a 2-way scroll container with sticky column headers when rows exist", async () => {
    const { container } = render(
      <LeadTable
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowCreateLeadModal={vi.fn()}
        deleteLead={vi.fn()}
        handleGoToChat={vi.fn()}
        activeChannel="all"
        companyCode="SPA01"
        branchId="main"
        accounts={accounts}
        onSelectAccountScope={vi.fn()}
      />,
    );

    await screen.findByText("Nguyễn Minh Anh");

    const scrollWrapper = container.querySelector(".visible-scrollbar.overflow-auto") as HTMLDivElement | null;
    expect(scrollWrapper).not.toBeNull();
    expect(scrollWrapper!.className).toContain("sm:flex-1");
    expect(scrollWrapper!.className).toContain("sm:min-h-0");

    const table = within(scrollWrapper!).getByRole("table");
    const thead = table.querySelector("thead");
    expect(thead).not.toBeNull();
    expect(thead!.className).toContain("sticky");
    expect(thead!.className).toContain("top-0");

    const firstBodyRow = table.querySelector("tbody tr");
    expect(firstBodyRow).not.toBeNull();
    const indexCell = firstBodyRow!.querySelector("td");
    expect(indexCell!.className).toContain("border-b");
    expect(indexCell!.className).not.toContain("group-last/row:border-b-0");
  });
});
