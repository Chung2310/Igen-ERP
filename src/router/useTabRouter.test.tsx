// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useTabRouter } from "./useTabRouter";

function Probe({ enabled }: { enabled: boolean }) {
  const { activeTab, setActiveTab } = useTabRouter({ enabled });
  return <>
    <p data-testid="active-tab">{activeTab}</p>
    <button onClick={() => setActiveTab("TỔNG QUAN")}>Mở tổng quan</button>
    <button onClick={() => setActiveTab("TRỢ LÝ KIẾN TRÚC")}>Mở trợ lý kiến trúc</button>
  </>;
}

afterEach(cleanup);

it("preserves a finance subtab URL when auth enables the router", () => {
  window.history.replaceState(null, "", "/tai-chinh?sub=so-quy");
  const view = render(<Probe enabled={false} />);
  view.rerender(<Probe enabled />);
  expect(window.location.pathname).toBe("/tai-chinh");
  expect(window.location.search).toBe("?sub=so-quy");

  act(() => screen.getByRole("button", { name: "Mở tổng quan" }).click());
  expect(window.location.pathname).toBe("/tong-quan");
});

it("opens and restores the architecture assistant route", () => {
  window.history.replaceState(null, "", "/tong-quan");
  const view = render(<Probe enabled />);

  act(() => screen.getByRole("button", { name: "Mở trợ lý kiến trúc" }).click());
  expect(window.location.pathname).toBe("/tro-ly-kien-truc");
  expect(screen.getByTestId("active-tab").textContent).toBe("TRỢ LÝ KIẾN TRÚC");

  view.unmount();
  window.history.replaceState(null, "", "/tro-ly-kien-truc");
  render(<Probe enabled />);
  expect(screen.getByTestId("active-tab").textContent).toBe("TRỢ LÝ KIẾN TRÚC");
});
