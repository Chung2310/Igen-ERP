// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("./context/AuthContext", () => ({
  AuthProvider: () => { throw new Error("The public feedback route must not initialize authentication"); },
  useAuth: vi.fn(),
}));
vi.mock("./modules/repair/pages/PublicRepairFeedbackPage", () => ({ default: () => <div>Public repair feedback form</div> }));

import App from "./App";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

test("renders repair feedback links without initializing the login flow", async () => {
  window.history.replaceState(null, "", "/repair/feedback/token-123");

  render(<App />);

  expect(await screen.findByText("Public repair feedback form")).not.toBeNull();
});
