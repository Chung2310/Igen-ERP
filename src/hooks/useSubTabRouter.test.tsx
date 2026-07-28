// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useSubTabRouter, type SubTabRouteMap } from "./useSubTabRouter";

type Tab = "OVERVIEW" | "FEES";

function Probe({
  routes,
  onRender,
}: {
  routes: SubTabRouteMap<Tab>;
  onRender: (active: Tab) => void;
}) {
  const [active] = useSubTabRouter(routes, "OVERVIEW");
  onRender(active);
  return <output aria-label="active">{active}</output>;
}

afterEach(cleanup);

it("does not render a removed active route for an extra frame", () => {
  window.history.replaceState(null, "", "/?sub=fees");
  const allRoutes: SubTabRouteMap<Tab> = [
    { slug: "overview", value: "OVERVIEW" },
    { slug: "fees", value: "FEES" },
  ];
  const workerRoutes: SubTabRouteMap<Tab> = [
    { slug: "overview", value: "OVERVIEW" },
  ];
  const rendersAfterPresetChange: Tab[] = [];
  const view = render(<Probe routes={allRoutes} onRender={() => undefined} />);
  expect(screen.getByLabelText("active").textContent).toBe("FEES");

  act(() => {
    view.rerender(
      <Probe
        routes={workerRoutes}
        onRender={(active) => rendersAfterPresetChange.push(active)}
      />,
    );
  });

  expect(rendersAfterPresetChange.length).toBeGreaterThan(0);
  expect(rendersAfterPresetChange.every((active) => active === "OVERVIEW")).toBe(true);
  expect(screen.getByLabelText("active").textContent).toBe("OVERVIEW");
  expect(new URLSearchParams(window.location.search).get("sub")).toBe("overview");
});
