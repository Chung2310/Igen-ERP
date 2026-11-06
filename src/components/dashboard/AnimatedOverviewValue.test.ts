import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";

describe("AnimatedOverviewValue", () => {
  it("starts at zero while exposing the actual KPI value to assistive technology", () => {
    const markup = renderToStaticMarkup(createElement(AnimatedOverviewValue, { value: 360, format: value => Math.round(value).toLocaleString("vi-VN") }));
    expect(markup).toContain('aria-hidden="true">0</span>');
    expect(markup).toContain('class="sr-only">360</span>');
  });
});
