import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TabType } from "../../types";
import { ModuleArtwork } from "./ModuleArtwork";

const launcherModules: TabType[] = [
  "TỔNG QUAN",
  "TRỢ LÝ AI",
  "NHÂN SỰ",
  "ĐỐI TÁC LAO ĐỘNG",
  "ĐỐI TÁC",
  "KHO & SẢN PHẨM",
  "SỬA CHỮA & BẢO HÀNH",
  "QUẢN LÝ HỌC VIÊN",
  "QUẢN LÝ LAO ĐỘNG",
  "QUẢN LÝ KHÁCH HÀNG",
  "BÁN LẺ",
  "ĐỐI TÁC BÁN LẺ",
  "TÀI CHÍNH",
  "OMNI INBOX",
  "MARKETING",
  "KHO TRI THỨC",
  "TÍCH HỢP MARKETING",
  "GÓI AI & LƯỢT SỬ DỤNG",
  "QUẢN LÝ TÀI NGUYÊN",
  "TRÒ CHUYỆN",
  "QUẢN TRỊ USER",
  "CÀI ĐẶT",
];

describe("ModuleArtwork", () => {
  it("gives every launcher module distinct artwork", () => {
    const rendered = launcherModules.map((module) => renderToStaticMarkup(<ModuleArtwork module={module} />));
    const fallback = renderToStaticMarkup(<ModuleArtwork module={"__unknown__" as TabType} />);
    expect(new Set(rendered).size).toBe(launcherModules.length);
    expect(rendered).not.toContain(fallback);
  });

  it("uses soft gradient tiles with custom white pictograms", () => {
    const svg = renderToStaticMarkup(<ModuleArtwork module="NHÂN SỰ" />);
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('stop-color="#F58AA0"');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).not.toContain('class="lucide');
    const chat = renderToStaticMarkup(<ModuleArtwork module="TRÒ CHUYỆN" />);
    expect(chat).toContain('stop-color="#B39AE9"');
    expect(chat).toContain('M6 9h31');
  });

  it("keeps Báo giá and Tài chính visually distinct", () => {
    const quotation = renderToStaticMarkup(<ModuleArtwork module="BÁO GIÁ" />);
    const finance = renderToStaticMarkup(<ModuleArtwork module="TÀI CHÍNH" />);
    expect(quotation).toContain('M10 5h21l8 8');
    expect(finance).toContain('m5 18 19-11 19 11');
    expect(quotation).not.toBe(finance);
  });
});
