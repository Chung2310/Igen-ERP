// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: { uid: "pt-1" },
    userProfile: { uid: "pt-1", role: "gym_pt", enabledModules: ["gym"], permissions: ["gym-pt:read"] },
    loading: false,
    hasPermission: () => true,
  }),
}));
vi.mock("./context/BranchContext", () => ({
  BranchProvider: ({ children }: { children: ReactNode }) => children,
  useBranch: () => ({ activeBranchId: null, loading: false, error: null }),
}));
vi.mock("./context/ChatUnreadContext", () => ({
  ChatUnreadProvider: ({ children }: { children: ReactNode }) => children,
  useChatUnread: () => ({ totalUnread: 0 }),
}));
vi.mock("./pages/ModuleLauncher", () => ({ default: () => <div>Danh sách chức năng PT</div> }));
vi.mock("./pages/Toast", () => ({ ToastContainer: () => null }));
vi.mock("./services/socketService", () => ({ socketService: { connect: vi.fn(), disconnect: vi.fn(), on: () => vi.fn() } }));
vi.mock("./services/browserNotificationService", () => ({ browserNotificationService: { requestPermission: async () => "denied" } }));
vi.mock("./services/pushService", () => ({ pushService: { subscribe: vi.fn() } }));
vi.mock("./utils/faviconBadge", () => ({ setFaviconBadge: vi.fn() }));

import App from "./App";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test("PT can return to the module list without being redirected back to Gym", async () => {
  window.history.replaceState(null, "", "/modules");
  render(<App />);

  expect(await screen.findByText("Danh sách chức năng PT")).not.toBeNull();
  await waitFor(() => expect(window.location.pathname).toBe("/modules"));
});
