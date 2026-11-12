import PizZip from "pizzip";
import type { AssistantSlideCanvasObject, AssistantSlideContent, AssistantSlideDeck, AssistantSlideTextStyle } from "../../shared/assistant-slide";
import { getAssistantSlideTheme, getSlideMetrics, inferSlideLayout } from "./assistant-slide-design";

const pptxMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const slideWidth = 12_192_000;
const slideHeight = 6_858_000;

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shape(id: number, name: string, x: number, y: number, cx: number, cy: number, paragraphs: string, options: { fill?: string; line?: string; geometry?: "rect" | "roundRect" | "ellipse" } = {}) {
  const fill = options.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : "<a:noFill/>";
  const line = options.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${options.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const textBody = paragraphs ? `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"><a:normAutofit fontScale="85000" lnSpcReduction="12000"/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody>` : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${options.geometry || "rect"}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>${textBody}</p:sp>`;
}

type PptxTextOptions = { size: number; color: string; bold?: boolean; italic?: boolean; underline?: boolean; align?: string; bullet?: boolean; bulletColor?: string; fontFace?: string };

function styledTextOptions(style: AssistantSlideTextStyle | undefined, base: PptxTextOptions): PptxTextOptions {
  const align = style?.align === "center" ? "ctr" : style?.align === "right" ? "r" : style?.align === "left" ? "l" : base.align;
  return {
    ...base,
    size: style?.fontSize ? style.fontSize * 75 : base.size,
    color: style?.color ? style.color.slice(1).toUpperCase() : base.color,
    bold: style?.bold ?? base.bold,
    italic: style?.italic ?? base.italic,
    underline: style?.underline ?? base.underline,
    align,
    fontFace: style?.fontFamily || base.fontFace,
  };
}

function textParagraph(text: string, options: PptxTextOptions) {
  const fontFace = xmlEscape(options.fontFace || "Aptos");
  const paragraphProperties = options.bullet
    ? `<a:pPr marL="304800" indent="-190500"><a:buClr><a:srgbClr val="${options.bulletColor || "2563EB"}"/></a:buClr><a:buSzPct val="100000"/><a:buChar char="•"/></a:pPr>`
    : `<a:pPr algn="${options.align || "l"}"/>`;
  const italic = options.italic ? ' i="1"' : "";
  const underline = options.underline ? ' u="sng"' : "";
  return `<a:p>${paragraphProperties}<a:r><a:rPr lang="vi-VN" sz="${options.size}" b="${options.bold ? 1 : 0}"${italic}${underline}><a:solidFill><a:srgbClr val="${options.color}"/></a:solidFill><a:latin typeface="${fontFace}"/><a:ea typeface="${fontFace}"/></a:rPr><a:t xml:space="preserve">${xmlEscape(text)}</a:t></a:r><a:endParaRPr lang="vi-VN" sz="${options.size}"/></a:p>`;
}

function headingParagraph(text: string, options: Parameters<typeof textParagraph>[1]) {
  return textParagraph(text, { ...options, fontFace: options.fontFace || "Aptos Display" });
}

function canvasObjectShapes(objects: AssistantSlideCanvasObject[]) {
  let imageIndex = 0;
  return objects.map((object, index) => {
    const x = Math.round(slideWidth * object.x / 100);
    const y = Math.round(slideHeight * object.y / 100);
    const cx = Math.round(slideWidth * object.width / 100);
    const cy = Math.round(slideHeight * object.height / 100);
    if (object.type === "text") {
      const color = object.style?.color?.slice(1).toUpperCase() || "202B3C";
      const paragraph = textParagraph(object.text || "", styledTextOptions(object.style, { size: 1800, color, bold: false, fontFace: "Aptos" }));
      return shape(120 + index, `Text ${index + 1}`, x, y, cx, cy, paragraph, { geometry: "roundRect" });
    }
    if (!object.src) return "";
    const relationId = `rId${imageIndex + 2}`;
    const imageShape = `<p:pic><p:nvPicPr><p:cNvPr id="${120 + index}" name="Ảnh ${index + 1}" descr="${xmlEscape(object.alt || "Ảnh trong slide")}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    imageIndex += 1;
    return imageShape;
  }).join("");
}

function canvasObjectRelationships(objects: AssistantSlideCanvasObject[], slideNumber: number) {
  let imageIndex = 0;
  return objects.filter(object => object.type === "image" && object.src).map(object => {
    const relationId = `rId${imageIndex + 2}`;
    const mime = object.src!.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1].toLowerCase() || "image/png";
    const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const filename = `slide${slideNumber}-image${imageIndex + 1}.${extension}`;
    imageIndex += 1;
    return { relationId, target: `../media/${filename}`, filename, source: object.src!, mime };
  });
}

function groupShapeTree(content: string) {
  return `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${content}</p:spTree>`;
}

function slideXml(content: string, background = "EFF6FF") {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${groupShapeTree(content)}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function coverSlide(deck: AssistantSlideDeck) {
  const theme = getAssistantSlideTheme(deck.themeId);
  const primary = theme.accents[0].slice(1).toUpperCase();
  const secondary = theme.accents[1].slice(1).toUpperCase();
  const title = shape(3, "Tiêu đề", 680_000, 1_800_000, 7_400_000, 1_650_000, headingParagraph(deck.title, styledTextOptions(deck.coverTextStyles?.title, { size: 3600, color: theme.ink.slice(1).toUpperCase(), bold: true })));
  const subtitle = shape(4, "Mô tả", 700_000, 3_650_000, 7_200_000, 900_000, textParagraph(deck.subtitle || "Bài thuyết trình được tạo từ nội dung của bạn", styledTextOptions(deck.coverTextStyles?.subtitle, { size: 1900, color: theme.muted.slice(1).toUpperCase() })));
  const label = shape(2, "Nhãn AI Studio", 700_000, 650_000, 4_800_000, 420_000, textParagraph("IGEN ERP  /  AI STUDIO", { size: 1100, color: primary, bold: true }));
  const emblem = shape(5, "Số trang trí", 9_200_000, 1_550_000, 1_850_000, 1_850_000, textParagraph("01", { size: 4800, color: "FFFFFF", bold: true, align: "ctr" }), { fill: primary, geometry: "roundRect" });
  const dot = shape(6, "Điểm nhấn", 10_800_000, 1_220_000, 480_000, 480_000, "", { fill: secondary, geometry: "ellipse" });
  const titles = deck.slides.slice(0, 3).map((slide, index) => shape(7 + index, `Mục ${index + 1}`, 700_000 + index * 3_350_000, 5_400_000, 3_050_000, 620_000, textParagraph(`${String(index + 1).padStart(2, "0")}  ·  ${slide.title}`, { size: 1100, color: theme.ink.slice(1).toUpperCase(), bold: true }), { fill: theme.cards[index].slice(1).toUpperCase() })).join("");
  return slideXml(label + title + subtitle + emblem + dot + titles + canvasObjectShapes(deck.coverObjects || []), theme.canvas.slice(1).toUpperCase());
}

function contentSlide(slide: AssistantSlideContent, index: number, total: number, deck: AssistantSlideDeck) {
  const theme = getAssistantSlideTheme(deck.themeId);
  return contentSlideWithTheme(slide, index, total, theme);
}

function contentSlideWithTheme(slide: AssistantSlideContent, index: number, total: number, theme: ReturnType<typeof getAssistantSlideTheme>) {
  const primary = theme.accents[0].slice(1).toUpperCase();
  const secondary = theme.accents[1].slice(1).toUpperCase();
  const ink = theme.ink.slice(1).toUpperCase();
  const muted = theme.muted.slice(1).toUpperCase();
  const soft = theme.soft.slice(1).toUpperCase();
  const accents = theme.accents.map(color => color.slice(1).toUpperCase());
  const overline = shape(2, "Nhãn bố cục", 580_000, 330_000, 5_800_000, 380_000, textParagraph(`${inferSlideLayout(slide).toUpperCase()}  ·  ${String(index).padStart(2, "0")}`, { size: 1000, color: primary, bold: true }));
  const title = shape(3, "Tiêu đề slide", 580_000, 790_000, 11_000_000, 850_000, headingParagraph(slide.title, styledTextOptions(slide.textStyles?.title, { size: 2700, color: ink, bold: true })));
  const keyMessage = slide.keyMessage ? shape(4, "Thông điệp chính", 580_000, 1_720_000, 11_000_000, 560_000, textParagraph(slide.keyMessage, styledTextOptions(slide.textStyles?.keyMessage, { size: 1550, color: ink, bold: true })), { fill: soft, line: theme.line.slice(1).toUpperCase(), geometry: "roundRect" }) : "";
  const bodyTop = slide.keyMessage ? 2_500_000 : 2_100_000;
  const bodyHeight = 3_650_000;
  const layout = inferSlideLayout(slide);
  let body = "";

  if (layout === "chart" && getSlideMetrics(slide).length >= 2) {
    const metrics = getSlideMetrics(slide);
    const max = Math.max(...metrics.map(item => item.value), 1);
    body = metrics.map((metric, itemIndex) => {
      const y = bodyTop + itemIndex * Math.floor(bodyHeight / metrics.length);
      const width = Math.max(220_000, Math.round(6_600_000 * metric.value / max));
      const bulletIndex = slide.bullets.indexOf(metric.label);
      const row = shape(10 + itemIndex * 2, `Nhãn dữ liệu ${itemIndex + 1}`, 650_000, y, 4_400_000, 450_000, textParagraph(metric.label, styledTextOptions(slide.textStyles?.[`bullet-${bulletIndex}`], { size: 1200, color: ink })));
      const bar = shape(11 + itemIndex * 2, `Giá trị ${itemIndex + 1}`, 5_000_000, y, width, 400_000, textParagraph(metric.rawValue, { size: 1150, color: "FFFFFF", bold: true, align: "r" }), { fill: accents[itemIndex % accents.length], geometry: "roundRect" });
      return row + bar;
    }).join("");
  } else if (layout === "timeline") {
    const cardWidth = Math.floor(10_850_000 / slide.bullets.length) - 90_000;
    const gap = 140_000;
    const line = shape(9, "Trục thời gian", 690_000, bodyTop + 350_000, 10_700_000, 55_000, "", { fill: theme.line.slice(1).toUpperCase() });
    const nodes = slide.bullets.map((bullet, itemIndex) => {
      const x = 620_000 + itemIndex * (cardWidth + gap);
      const node = shape(10 + itemIndex * 2, `Mốc ${itemIndex + 1}`, x + Math.floor(cardWidth / 2) - 145_000, bodyTop + 215_000, 290_000, 290_000, "", { fill: accents[itemIndex % accents.length], geometry: "ellipse" });
      const card = shape(11 + itemIndex * 2, `Nội dung mốc ${itemIndex + 1}`, x, bodyTop + 700_000, cardWidth, bodyHeight - 750_000, textParagraph(bullet, styledTextOptions(slide.textStyles?.[`bullet-${itemIndex}`], { size: 1150, color: ink, bold: true })), { fill: theme.cards[itemIndex % theme.cards.length].slice(1).toUpperCase(), geometry: "roundRect" });
      return node + card;
    }).join("");
    body = line + nodes;
  } else if (layout === "comparison") {
    const split = Math.ceil(slide.bullets.length / 2);
    const groups = [slide.bullets.slice(0, split), slide.bullets.slice(split)];
    body = groups.map((group, groupIndex) => {
      const x = groupIndex === 0 ? 620_000 : 6_150_000;
      const fill = theme.cards[groupIndex].slice(1).toUpperCase();
      const items = group.map((bullet, itemIndex) => textParagraph(bullet, styledTextOptions(slide.textStyles?.[`bullet-${groupIndex === 0 ? itemIndex : split + itemIndex}`], { size: 1450, color: ink, bullet: true, bulletColor: accents[groupIndex] }))).join("");
      const panel = shape(10 + groupIndex * 3, `Nhóm ${groupIndex + 1}`, x, bodyTop, 5_400_000, bodyHeight, "", { fill, geometry: "roundRect" });
      const heading = shape(11 + groupIndex * 3, `Nhãn nhóm ${groupIndex + 1}`, x + 180_000, bodyTop + 100_000, 4_900_000, 420_000, textParagraph(`NHÓM ${groupIndex + 1}`, { size: 1000, color: accents[groupIndex], bold: true }));
      const content = shape(12 + groupIndex * 3, `Nội dung nhóm ${groupIndex + 1}`, x + 80_000, bodyTop + 550_000, 5_150_000, bodyHeight - 600_000, items);
      return panel + heading + content;
    }).join("");
  } else {
    const columns = layout === "steps" && slide.bullets.length >= 3 ? 3 : slide.bullets.length > 2 ? 2 : 1;
    const rows = Math.ceil(slide.bullets.length / columns);
    const gapX = 160_000;
    const cardWidth = Math.floor((10_900_000 - gapX * (columns - 1)) / columns);
    const cardHeight = Math.floor(bodyHeight / rows) - 120_000;
    body = slide.bullets.map((bullet, itemIndex) => {
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      const x = 620_000 + column * (cardWidth + gapX);
      const y = bodyTop + row * Math.floor(bodyHeight / rows);
      const fill = theme.cards[itemIndex % theme.cards.length].slice(1).toUpperCase();
      const accent = accents[itemIndex % accents.length];
      const tile = shape(10 + itemIndex * 2, `${layout === "steps" ? "Bước" : "Ý"} ${itemIndex + 1}`, x, y, cardWidth, cardHeight, textParagraph(bullet, styledTextOptions(slide.textStyles?.[`bullet-${itemIndex}`], { size: layout === "steps" ? 1400 : 1450, color: ink, bold: true })), { fill, line: accent, geometry: "roundRect" });
      const number = shape(11 + itemIndex * 2, `Số thứ tự ${itemIndex + 1}`, x + 110_000, y + 90_000, 450_000, 450_000, textParagraph(String(itemIndex + 1).padStart(2, "0"), { size: 900, color: accent, bold: true, align: "ctr" }), { fill: "FFFFFF", geometry: "ellipse" });
      return tile + number;
    }).join("");
  }

  const footer = shape(90, "Số trang", 10_600_000, 6_270_000, 1_000_000, 300_000, textParagraph(`${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, { size: 900, color: muted, align: "r" }));
  return slideXml(overline + title + keyMessage + body + footer + canvasObjectShapes(slide.objects || []), theme.canvas.slice(1).toUpperCase());
}

function addPowerPointPackage(zip: PizZip, slideCount: number, title: string, createdAt: string) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const presentationRels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="vi-VN"/></a:defPPr></p:defaultTextStyle></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationRels}</Relationships>`);
  zip.file("ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${groupShapeTree("")}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file("ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank">${groupShapeTree("")}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  zip.file("ppt/theme/theme1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="iGen ERP"><a:themeElements><a:clrScheme name="iGen"><a:dk1><a:srgbClr val="071629"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="223247"/></a:dk2><a:lt2><a:srgbClr val="F6F8FD"/></a:lt2><a:accent1><a:srgbClr val="00ADFC"/></a:accent1><a:accent2><a:srgbClr val="008AC9"/></a:accent2><a:accent3><a:srgbClr val="39B9D4"/></a:accent3><a:accent4><a:srgbClr val="78C9F1"/></a:accent4><a:accent5><a:srgbClr val="475569"/></a:accent5><a:accent6><a:srgbClr val="D8E2F0"/></a:accent6><a:hlink><a:srgbClr val="008AC9"/></a:hlink><a:folHlink><a:srgbClr val="475569"/></a:folHlink></a:clrScheme><a:fontScheme name="iGen"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Aptos Display"/><a:cs typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Aptos"/><a:cs typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="iGen"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"/></a:gs></a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>iGen ERP</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(createdAt)}</dcterms:created></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>iGen ERP AI Studio</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${slideCount}</Slides></Properties>`);
}

function syncPowerPointTheme(zip: PizZip, theme: ReturnType<typeof getAssistantSlideTheme>) {
  const file = zip.file("ppt/theme/theme1.xml");
  if (!file) return;
  let xml = file.asText();
  const replacements: Array<[string, string]> = [
    ["071629", theme.ink], ["223247", theme.ink], ["F6F8FD", theme.canvas],
    ["00ADFC", theme.primary], ["008AC9", theme.secondary],
    ["39B9D4", theme.accents[2]], ["78C9F1", theme.accents[3]],
    ["475569", theme.accents[4]], ["D8E2F0", theme.line],
  ];
  for (const [from, to] of replacements) xml = xml.replaceAll(`val="${from}"`, `val="${to.slice(1).toUpperCase()}"`);
  zip.file("ppt/theme/theme1.xml", xml);
}

export function buildAssistantSlideDeckPackage(deck: AssistantSlideDeck) {
  const zip = new PizZip();
  const slides = [coverSlide(deck), ...deck.slides.map((slide, index) => contentSlide(slide, index + 2, deck.slides.length + 1, deck))];
  const objectsBySlide = [deck.coverObjects || [], ...deck.slides.map(slide => slide.objects || [])];
  slides.forEach((xml, index) => {
    const imageRelationships = canvasObjectRelationships(objectsBySlide[index], index + 1);
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml);
    imageRelationships.forEach(relationship => {
      const base64 = relationship.source.slice(relationship.source.indexOf(",") + 1);
      zip.file(`ppt/media/${relationship.filename}`, base64, { base64: true });
    });
    const relationships = imageRelationships.map(relationship => `<Relationship Id="${relationship.relationId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${relationship.target}"/>`).join("");
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${relationships}</Relationships>`);
  });
  addPowerPointPackage(zip, slides.length, deck.title, deck.createdAt);
  syncPowerPointTheme(zip, getAssistantSlideTheme(deck.themeId));
  return zip;
}

export function downloadAssistantSlideDeck(deck: AssistantSlideDeck) {
  const zip = buildAssistantSlideDeckPackage(deck);
  const file = zip.generate({ type: "blob", mimeType: pptxMime, compression: "DEFLATE" }) as Blob;
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deck.title.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "bai-thuyet-trinh"}.pptx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
