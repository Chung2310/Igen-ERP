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

  it("uses a distinct solid tile with a white pictogram", () => {
    const svg = renderToStaticMarkup(<ModuleArtwork module="NHÂN SỰ" />);
    expect(svg).toContain('rx="11" fill="#E95070"');
    expect(svg).toContain('#FFFFFF');
    expect(svg).not.toContain('<linearGradient');
    const chat = renderToStaticMarkup(<ModuleArtwork module="TRÒ CHUYỆN" />);
    expect(chat).toContain('rx="11" fill="#7958C9"');
    expect(chat).not.toContain('#E95070');
  });

  it("uses a recognizable robot face for the AI assistant", () => {
    const svg = renderToStaticMarkup(<ModuleArtwork module="TRỢ LÝ AI" />);
    const fallback = renderToStaticMarkup(<ModuleArtwork module={"__unknown__" as TabType} />);
    expect(svg).toContain('x="8" y="15" width="32" height="28"');
    expect(svg).toContain('cx="19" cy="28"');
    expect(svg).not.toBe(fallback);
  });
});
