import { useId, type ReactNode } from "react";
import type { TabType } from "../../types";

type ArtworkProps = { module: TabType; className?: string };

// Custom detailed app marks on soft gradient tiles.
const accentPalettes = {
  blue: { from: "#67B3F2", bg: "#2477E8", mid: "#8ED4FF", light: "#DDF3FF", detail: "#FFE28B" },
  coral: { from: "#F58AA0", bg: "#E95070", mid: "#FFB5C0", light: "#FFE2E7", detail: "#FFD58B" },
  orange: { from: "#F6B363", bg: "#D77D19", mid: "#FFD087", light: "#FFF0D7", detail: "#7F4612" },
  teal: { from: "#57D4C5", bg: "#0A9F96", mid: "#92E4D6", light: "#E0FFF6", detail: "#FFDA88" },
  violet: { from: "#B39AE9", bg: "#7958C9", mid: "#CAB9F4", light: "#F0E9FF", detail: "#FFDC8D" },
} as const;

const accentByModule: Partial<Record<TabType, keyof typeof accentPalettes>> = {
  "BÁO GIÁ": "teal", "TỔNG QUAN": "blue", "TRỢ LÝ AI": "blue", "NHÂN SỰ": "coral", "ĐỐI TÁC LAO ĐỘNG": "orange",
  "ĐỐI TÁC": "violet", "KHO & SẢN PHẨM": "teal", "SỬA CHỮA & BẢO HÀNH": "orange",
  "QUẢN LÝ HỌC VIÊN": "blue", "QUẢN LÝ LAO ĐỘNG": "teal",
  "QUẢN LÝ KHÁCH HÀNG": "coral", "BÁN LẺ": "orange",
  "ĐỐI TÁC BÁN LẺ": "teal", "TÀI CHÍNH": "blue",
  "OMNI INBOX": "violet",
  "MARKETING": "orange", "KHO TRI THỨC": "teal",
  "TÍCH HỢP MARKETING": "blue", "GÓI AI & LƯỢT SỬ DỤNG": "violet",
  "QUẢN LÝ TÀI NGUYÊN": "orange", "TRÒ CHUYỆN": "violet",
  "QUẢN TRỊ USER": "blue", "CÀI ĐẶT": "teal",
};

export function ModuleArtwork({ module, className = "" }: ArtworkProps) {
  const accent = accentPalettes[accentByModule[module] ?? "blue"];
  const a = {
    blue: "#FFFFFF", mint: accent.mid, gold: accent.light,
    coral: accent.detail, white: accent.bg,
  };
  let art: ReactNode;
  switch (module) {
    case "TỔNG QUAN":
      art = <><path d="M7 36V25h8v11z" fill={a.mint}/><path d="M18 36V17h8v19z" fill={a.blue}/><path d="M29 36V10h8v26z" fill={a.gold}/><path d="M6 39h33" stroke={a.white} strokeWidth="3" strokeLinecap="round"/><circle cx="33" cy="10" r="4" fill={a.coral}/></>; break;
    case "TRỢ LÝ AI":
      art = <><path d="M24 7v8" stroke={a.blue} strokeWidth="3" strokeLinecap="round"/><circle cx="24" cy="7" r="3.5" fill={a.coral}/><rect x="4" y="24" width="6" height="11" rx="2" fill={a.mint}/><rect x="38" y="24" width="6" height="11" rx="2" fill={a.mint}/><rect x="8" y="15" width="32" height="28" rx="8" fill={a.blue}/><rect x="12" y="20" width="24" height="16" rx="5" fill={a.gold}/><circle cx="19" cy="28" r="2.5" fill={a.white}/><circle cx="29" cy="28" r="2.5" fill={a.white}/><path d="M21 39h6" stroke={a.white} strokeWidth="2.5" strokeLinecap="round"/></>; break;
    case "NHÂN SỰ":
      art = <><circle cx="17" cy="16" r="7" fill={a.gold}/><circle cx="32" cy="18" r="6" fill={a.coral}/><path d="M5 35c0-8 5-13 12-13s12 5 12 13v4H5z" fill={a.blue}/><path d="M25 27c2-3 5-4 8-4 6 0 10 5 10 12v4H30v-4c0-3-2-6-5-8" fill={a.mint}/><path d="M11 35h12" stroke={a.white} strokeWidth="2" strokeLinecap="round"/></>; break;
    case "KHO & SẢN PHẨM":
      art = <><path d="m5 16 18-9 18 9-18 9z" fill={a.gold}/><path d="M5 19 23 28v14L5 33z" fill={a.blue}/><path d="m41 19-18 9v14l18-9z" fill={a.mint}/><path d="m14 12 18 9M23 28v14" stroke={a.white} strokeWidth="2" opacity=".8"/></>; break;
    case "SỬA CHỮA & BẢO HÀNH":
      art = <><path d="M30 7a11 11 0 0 0-10 14L7 34a5 5 0 0 0 7 7l13-13A11 11 0 0 0 41 17l-8 7-7-3-3-7z" fill={a.blue}/><path d="M30 7a11 11 0 0 0-10 14l7 7A11 11 0 0 0 41 17l-8 7-7-3-3-7z" fill={a.mint}/><circle cx="11" cy="37" r="2" fill={a.white}/><path d="m30 30 5 2v5l-5 3-5-3v-5z" fill={a.gold}/></>; break;
    case "QUẢN LÝ HỌC VIÊN":
      art = <><path d="m4 17 19-9 19 9-19 9z" fill={a.blue}/><path d="M12 24v9c7 6 15 6 22 0v-9l-11 5z" fill={a.mint}/><circle cx="23" cy="17" r="4" fill={a.gold}/><path d="M42 18v13" stroke={a.gold} strokeWidth="3" strokeLinecap="round"/><circle cx="42" cy="34" r="3" fill={a.coral}/></>; break;
    case "QUẢN LÝ LAO ĐỘNG":
      art = <><path d="M8 16h32v24H8z" rx="4" fill={a.blue}/><path d="M17 16v-4a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4" fill="none" stroke={a.gold} strokeWidth="4"/><path d="M8 22h32v7H8z" fill={a.mint}/><path d="M21 24h6v9h-6z" fill={a.gold}/></>; break;
    case "QUẢN LÝ KHÁCH HÀNG":
      art = <><rect x="5" y="9" width="38" height="31" rx="5" fill={a.blue}/><circle cx="17" cy="21" r="6" fill={a.mint}/><path d="M9 34c0-5 3-8 8-8s8 3 8 8z" fill={a.mint}/><path d="M29 18h9m-9 6h9m-9 6h6" stroke={a.white} strokeWidth="2.5" strokeLinecap="round"/><circle cx="39" cy="36" r="5" fill={a.coral}/><path d="m37 36 1.5 1.5 3-3" stroke={a.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>; break;
    case "BÁN LẺ":
      art = <><path d="M6 20 10 9h28l4 11v7H6z" fill={a.coral}/><path d="M10 9h28l4 11H6z" fill={a.gold}/><path d="M7 27h34v14H7z" fill={a.blue}/><path d="M15 28h10v13H15z" fill={a.white}/><path d="M31 31h7v6h-7z" fill={a.mint}/><path d="M6 20c0 5 7 7 9 1 2 6 8 6 10 0 2 6 8 6 10 0 2 6 7 4 7-1" fill={a.coral}/></>; break;
    case "BÁO GIÁ":
      art = <><path d="M10 5h21l8 8v27a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" fill={a.blue}/><path d="M31 5v8h8z" fill={a.gold}/><path d="M13 18h18M13 24h15M13 30h10" stroke={a.white} strokeWidth="2.5" strokeLinecap="round"/><circle cx="32" cy="35" r="8" fill={a.mint}/><path d="m28.5 35 2.5 2.5 4.5-5" stroke={a.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>; break;
    case "TÀI CHÍNH":
      art = <><path d="m5 18 19-11 19 11v4H5z" fill={a.gold}/><path d="M8 24h6v13H8zm13 0h6v13h-6zm13 0h6v13h-6z" fill={a.blue}/><path d="M5 38h38v4H5z" fill={a.mint}/><circle cx="24" cy="16" r="3" fill={a.white}/></>; break;
    case "QUẢN LÝ TÀI NGUYÊN":
      art = <><path d="M5 13h16l4 5h18v22H5z" fill={a.gold}/><path d="M5 22h38v18H5z" fill={a.blue}/><path d="m24 25 7 3v5c0 5-4 7-7 9-3-2-7-4-7-9v-5z" fill={a.mint}/><path d="m21 32 2 2 4-4" fill="none" stroke={a.white} strokeWidth="2.5" strokeLinecap="round"/></>; break;
    case "TRÒ CHUYỆN":
      art = <><path d="M6 9h31a5 5 0 0 1 5 5v18a5 5 0 0 1-5 5H20L9 43v-6H6a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4" fill={a.blue}/><circle cx="14" cy="23" r="3" fill={a.white}/><circle cx="24" cy="23" r="3" fill={a.gold}/><circle cx="34" cy="23" r="3" fill={a.mint}/></>; break;
    case "ĐỐI TÁC":
      art = <><path d="M5 18 24 9l19 9-19 9z" fill={a.blue}/><path d="M9 27c6-2 11-1 15 3v11c-4-4-9-5-15-3z" fill={a.gold}/><path d="M39 27c-6-2-11-1-15 3v11c4-4 9-5 15-3z" fill={a.mint}/><path d="M24 30v11M14 31l6 2m14-2-6 2" stroke={a.white} strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="17" r="3.5" fill={a.coral}/></>; break;
    case "ĐỐI TÁC LAO ĐỘNG":
      art = <><path d="M9 19c0-8 6-13 15-13s15 5 15 13z" fill={a.gold}/><path d="M6 19h36v5H6z" fill={a.blue}/><path d="M17 8v8m14-8v8" stroke={a.white} strokeWidth="2" strokeLinecap="round"/><circle cx="15" cy="30" r="5" fill={a.blue}/><circle cx="33" cy="30" r="5" fill={a.mint}/><path d="M5 42c0-5 4-8 10-8s10 3 10 8zm18 0c0-5 4-8 10-8s10 3 10 8z" fill={a.blue}/><path d="M23 42c0-5 4-8 10-8s10 3 10 8z" fill={a.mint}/><path d="m20 34 4 3 4-3" fill="none" stroke={a.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></>; break;
    case "ĐỐI TÁC BÁN LẺ":
      art = <><path d="M5 12h24l5 8H5z" fill={a.gold}/><path d="M7 21h25v19H7z" fill={a.blue}/><path d="M12 27h8v13h-8zm11 0h6v7h-6z" fill={a.white}/><path d="M33 9h10v13H33z" fill={a.mint}/><circle cx="38" cy="14" r="2" fill={a.white}/><path d="m30 29 7-4 8 4-8 5z" fill={a.coral}/><path d="m30 29 7 5v8l-7-5z" fill={a.gold}/><path d="m45 29-8 5v8l8-5z" fill={a.mint}/></>; break;
    case "OMNI INBOX":
      art = <><path d="M5 10h27v23H15L5 40z" fill={a.blue}/><path d="M19 18h25v23l-8-6H19z" fill={a.mint}/><path d="M10 17h14M10 23h9" stroke={a.white} strokeWidth="2" strokeLinecap="round"/><circle cx="27" cy="27" r="2.5" fill={a.gold}/><circle cx="35" cy="27" r="2.5" fill={a.coral}/></>; break;
    case "MARKETING":
      art = <><path d="M24 6 9 25h12l-3 17 21-24H27l4-12z" fill={a.gold}/><path d="m24 6-4 18h-9z" fill={a.blue}/><circle cx="37" cy="35" r="6" fill={a.mint}/><path d="m34 35 2 2 4-5" fill="none" stroke={a.white} strokeWidth="2"/></>; break;
    case "KHO TRI THỨC":
      art = <><path d="M6 10h17v31H6a5 5 0 0 0-4 2V14a4 4 0 0 1 4-4" fill={a.blue}/><path d="M42 10H25v31h17a5 5 0 0 1 4 2V14a4 4 0 0 0-4-4" fill={a.mint}/><path d="M8 17h10M8 23h10M30 17h10M30 23h10" stroke={a.white} strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="8" r="4" fill={a.gold}/></>; break;
    case "TÍCH HỢP MARKETING":
      art = <><rect x="4" y="8" width="17" height="15" rx="3" fill={a.blue}/><rect x="27" y="25" width="17" height="15" rx="3" fill={a.mint}/><path d="M21 15h9v10M27 20l3 5 5-3M27 33h-9V23M21 28l-3-5-5 3" fill="none" stroke={a.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="15" r="3" fill={a.white}/><circle cx="36" cy="33" r="3" fill={a.white}/></>; break;
    case "GÓI AI & LƯỢT SỬ DỤNG":
      art = <><path d="m24 4 4 14 14 4-14 4-4 14-4-14-14-4 14-4z" fill={a.blue}/><path d="m24 10 2 8 8 4-8 2-2 8-2-8-8-2 8-4z" fill={a.mint}/><circle cx="38" cy="36" r="5" fill={a.gold}/><circle cx="8" cy="37" r="3" fill={a.coral}/></>; break;
    case "QUẢN TRỊ USER":
      art = <><path d="m24 5 17 7v12c0 11-7 16-17 20C14 40 7 35 7 24V12z" fill={a.blue}/><circle cx="24" cy="19" r="6" fill={a.gold}/><path d="M13 34c1-7 5-10 11-10s10 3 11 10" fill={a.mint}/></>; break;
    case "CÀI ĐẶT":
      art = <><path d="M20 4h8l2 6 5 2 6-3 5 7-4 5v6l4 5-5 7-6-3-5 2-2 6h-8l-2-6-5-2-6 3-5-7 4-5v-6l-4-5 5-7 6 3 5-2z" fill={a.blue}/><circle cx="24" cy="24" r="12" fill={a.mint}/><circle cx="24" cy="24" r="7" fill={a.white}/><circle cx="24" cy="24" r="4" fill={a.gold}/></>; break;
    default:
      art = <><rect x="10" y="10" width="28" height="28" rx="7" fill={a.blue}/><circle cx="24" cy="24" r="9" fill={a.gold}/><circle cx="24" cy="24" r="4" fill={a.white}/><path d="M22 4h4v6h-4zM22 38h4v6h-4zM4 22h6v4H4zM38 22h6v4h-6z" fill={a.mint}/></>;
  }
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={accent.from}/><stop offset="100%" stopColor={accent.bg}/></linearGradient></defs><rect x="0.5" y="0.5" width="47" height="47" rx="11" fill={"url(#" + gradientId + ")"} stroke="rgba(255, 255, 255, 0.32)"/><g transform="translate(4 4) scale(.833333)">{art}</g></svg>;
}
