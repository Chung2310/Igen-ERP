// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useTabRouter } from "./useTabRouter";

function Probe({ enabled }: { enabled: boolean }) {
  const { activeTab, setActiveTab } = useTabRouter({ enabled });
  return <button onClick={() => setActiveTab("TỔNG QUAN")}>{activeTab}</button>;
}

afterEach(cleanup);

it("preserves a finance subtab URL when auth enables the router", () => {
  window.history.replaceState(null, "", "/tai-chinh?sub=so-quy");
  const view = render(<Probe enabled={false} />);
  view.rerender(<Probe enabled />);
  expect(window.location.pathname).toBe("/tai-chinh");
  expect(window.location.search).toBe("?sub=so-quy");

  act(() => screen.getByRole("button").click());
  expect(window.location.pathname).toBe("/tong-quan");
});
