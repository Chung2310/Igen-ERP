// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const authMocks = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getUsersByCompany: vi.fn(),
  getColleagues: vi.fn(),
}));
const faceMocks = vi.hoisted(() => ({
  getFaceEnrollmentStatus: vi.fn(),
  enrollFace: vi.fn(),
  deleteFaceEnrollment: vi.fn(),
}));
const authState = vi.hoisted(() => ({ userProfile: null as unknown }));

vi.mock("../../services/authService", () => ({ authService: authMocks }));
vi.mock("../../services/faceManagementService", async importOriginal => ({
  ...(await importOriginal<typeof import("../../services/faceManagementService")>()),
  ...faceMocks,
}));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("../../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("./FaceEnrollmentCameraModal", () => ({
  default: ({ onSubmit, onClose }: { onSubmit: (b: Blob) => Promise<void>; onClose: () => void }) => (
    <div>
      <button onClick={() => void onSubmit(new Blob(["jpeg"], { type: "image/jpeg" })).catch(() => {})}>
        Giả lập chụp
      </button>
      <button onClick={onClose}>Giả lập đóng</button>
    </div>
  ),
}));

import FaceRecognitionSettingsTab from "./FaceRecognitionSettingsTab";

const employees = [
  { uid: "u1", displayName: "Nguyễn Văn A", email: "a@igen.vn", role: "user" },
  { uid: "u2", displayName: "Trần Thị B", email: "b@igen.vn", role: "manager" },
  { uid: "sa", displayName: "Super Admin", email: "root@igen.vn", role: "superadmin" },
];

describe("FaceRecognitionSettingsTab", () => {
  beforeEach(() => {
    authState.userProfile = { uid: "admin1", role: "admin", companyCode: "IGEN", permissions: [] };
    authMocks.getUsersByCompany.mockResolvedValue(employees);
    authMocks.getAllUsers.mockResolvedValue(employees);
    faceMocks.getFaceEnrollmentStatus.mockResolvedValue({ registered: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders employee rows and excludes superadmin accounts", async () => {
    render(<FaceRecognitionSettingsTab />);
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
    expect(screen.queryByText("Super Admin")).toBeNull();
  });

  it("shows enrollment status per employee", async () => {
    faceMocks.getFaceEnrollmentStatus.mockImplementation(async (uid: string) => ({
      registered: uid === "u2",
    }));
    render(<FaceRecognitionSettingsTab />);
    await screen.findByText("Nguyễn Văn A");
    await waitFor(() => {
      expect(screen.getByText("Chưa khởi tạo")).toBeTruthy();
      expect(screen.getByText("Đã khởi tạo")).toBeTruthy();
    });
  });

  it("marks only the failing employee as unavailable", async () => {
    faceMocks.getFaceEnrollmentStatus.mockImplementation(async (uid: string) => {
      if (uid === "u1") throw new Error("boom");
      return { registered: true };
    });
    render(<FaceRecognitionSettingsTab />);
    await waitFor(() => {
      expect(screen.getByText("Không kiểm tra được")).toBeTruthy();
      expect(screen.getByText("Đã khởi tạo")).toBeTruthy();
    });
  });

  it("filters employees by name or email", async () => {
    const user = userEvent.setup();
    render(<FaceRecognitionSettingsTab />);
    await screen.findByText("Nguyễn Văn A");
    await user.type(screen.getByPlaceholderText(/Tìm kiếm/), "b@igen.vn");
    expect(screen.queryByText("Nguyễn Văn A")).toBeNull();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
  });

  it("enroll success flips the row to registered", async () => {
    faceMocks.enrollFace.mockResolvedValue({ registered: true, operation: "register" });
    const user = userEvent.setup();
    render(<FaceRecognitionSettingsTab />);
    const row = (await screen.findByText("Nguyễn Văn A")).closest("li") as HTMLElement;
    await waitFor(() => expect(within(row).getByText("Chưa khởi tạo")).toBeTruthy());
    await user.click(within(row).getByRole("button", { name: /Khởi tạo nhận diện/ }));
    await user.click(screen.getByRole("button", { name: "Giả lập chụp" }));
    await waitFor(() => expect(faceMocks.enrollFace).toHaveBeenCalledWith("u1", expect.any(Blob)));
    await waitFor(() => expect(within(row).getByText("Đã khởi tạo")).toBeTruthy());
  });

  it("delete requires confirmation and flips the row back", async () => {
    faceMocks.getFaceEnrollmentStatus.mockResolvedValue({ registered: true });
    faceMocks.deleteFaceEnrollment.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FaceRecognitionSettingsTab />);
    const row = (await screen.findByText("Nguyễn Văn A")).closest("li") as HTMLElement;
    await waitFor(() => expect(within(row).getByText("Đã khởi tạo")).toBeTruthy());
    await user.click(within(row).getByRole("button", { name: /Xóa nhận diện/ }));
    expect(faceMocks.deleteFaceEnrollment).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await waitFor(() => expect(faceMocks.deleteFaceEnrollment).toHaveBeenCalledWith("u1"));
    await waitFor(() => expect(within(row).getByText("Chưa khởi tạo")).toBeTruthy());
  });

  it("superadmin loads every user instead of company scope", async () => {
    authState.userProfile = { uid: "root", role: "superadmin", permissions: ["*"] };
    render(<FaceRecognitionSettingsTab />);
    await screen.findByText("Nguyễn Văn A");
    expect(authMocks.getAllUsers).toHaveBeenCalled();
    expect(authMocks.getUsersByCompany).not.toHaveBeenCalled();
  });
});
