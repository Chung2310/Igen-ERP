import { useId, useRef } from "react";
import { Download } from "lucide-react";
import type { AssistantMindmapNode, AssistantMindmapResult } from "../../shared/assistant-mindmap";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const svgNamespace = "http://www.w3.org/2000/svg";
const width = 2_500;
const nodeWidth = 220;
const verticalSpacePerLeaf = 112;
const branchTones = [
  { edge: "stroke-emerald-500/80", branchBox: "fill-emerald-700 stroke-emerald-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-emerald-50 stroke-emerald-400", label: "fill-emerald-950", detail: "fill-emerald-800" },
  { edge: "stroke-amber-500/90", branchBox: "fill-amber-300 stroke-amber-500", branchLabel: "fill-amber-950", branchDetail: "fill-amber-950/85", nodeBox: "fill-amber-50 stroke-amber-400", label: "fill-amber-950", detail: "fill-amber-800" },
  { edge: "stroke-orange-500/80", branchBox: "fill-orange-700 stroke-orange-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-orange-50 stroke-orange-400", label: "fill-orange-950", detail: "fill-orange-800" },
  { edge: "stroke-rose-500/80", branchBox: "fill-rose-700 stroke-rose-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-rose-50 stroke-rose-400", label: "fill-rose-950", detail: "fill-rose-800" },
  { edge: "stroke-sky-500/80", branchBox: "fill-sky-700 stroke-sky-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-sky-50 stroke-sky-400", label: "fill-sky-950", detail: "fill-sky-800" },
  { edge: "stroke-violet-500/80", branchBox: "fill-violet-700 stroke-violet-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-violet-50 stroke-violet-400", label: "fill-violet-950", detail: "fill-violet-800" },
  { edge: "stroke-fuchsia-500/80", branchBox: "fill-fuchsia-700 stroke-fuchsia-800", branchLabel: "fill-white", branchDetail: "fill-white/90", nodeBox: "fill-fuchsia-50 stroke-fuchsia-400", label: "fill-fuchsia-950", detail: "fill-fuchsia-800" },
  { edge: "stroke-lime-600/80", branchBox: "fill-lime-300 stroke-lime-500", branchLabel: "fill-lime-950", branchDetail: "fill-lime-950/85", nodeBox: "fill-lime-50 stroke-lime-400", label: "fill-lime-950", detail: "fill-lime-800" },
];

interface MindmapPosition {
  node: AssistantMindmapNode;
  depth: number;
  side: -1 | 0 | 1;
  branch: number;
  x: number;
  y: number;
  parent?: MindmapPosition;
}

function leafCount(node: AssistantMindmapNode): number {
  return node.children.length ? node.children.reduce((sum, child) => sum + leafCount(child), 0) : 1;
}

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxCharacters - 1).trimEnd()}…`;
  }
  return lines;
}

function mapPositions(root: AssistantMindmapNode) {
  const leaves = leafCount(root);
  const height = Math.max(640, leaves * verticalSpacePerLeaf + 160);
  const centerX = width / 2;
  const positions: MindmapPosition[] = [];
  const edges: Array<{ parent: MindmapPosition; child: MindmapPosition }> = [];

  const place = (node: AssistantMindmapNode, depth: number, side: -1 | 0 | 1, branch: number, top: number, span: number, parent?: MindmapPosition) => {
    const position: MindmapPosition = {
      node,
      depth,
      side,
      branch,
      x: centerX + side * depth * 300,
      y: top + span / 2,
      parent,
    };
    positions.push(position);
    if (parent) edges.push({ parent, child: position });
    if (!node.children.length) return;
    const childLeaves = node.children.map(leafCount);
    const total = childLeaves.reduce((sum, count) => sum + count, 0);
    let cursor = top;
    node.children.forEach((child, index) => {
      const childSpan = span * childLeaves[index] / total;
      const childSide = depth === 0 ? (index % 2 === 0 ? -1 : 1) : side;
      place(child, depth + 1, childSide, depth === 0 ? index : branch, cursor, childSpan, position);
      cursor += childSpan;
    });
  };

  const top = (height - leaves * verticalSpacePerLeaf) / 2;
  place(root, 0, 0, -1, top, leaves * verticalSpacePerLeaf);
  return { positions, edges, height };
}

function edgePath(parent: MindmapPosition, child: MindmapPosition): string {
  const direction = child.x > parent.x ? 1 : -1;
  const startX = parent.x + direction * (parent.depth === 0 ? 130 : nodeWidth / 2);
  const endX = child.x - direction * nodeWidth / 2;
  const curveX = startX + (endX - startX) * 0.55;
  return `M ${startX} ${parent.y} C ${curveX} ${parent.y}, ${curveX} ${child.y}, ${endX} ${child.y}`;
}

function exportSvg(source: SVGSVGElement): void {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", svgNamespace);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", source.getAttribute("viewBox")?.split(" ")[3] || "640");
  const colorVariables = ["primary", "on-primary", "surface-container-lowest", "on-surface", "on-surface-variant", "outline-variant"];
  const rootStyles = getComputedStyle(source);
  clone.style.cssText = colorVariables.map(name => `--color-${name}:${rootStyles.getPropertyValue(`--color-${name}`).trim()}`).join(";");
  const originalElements = [source, ...source.querySelectorAll<SVGElement>("*")];
  const clonedElements = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  originalElements.forEach((element, index) => {
    const computed = getComputedStyle(element);
    for (const property of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "stroke-linecap", "stroke-linejoin"]) {
      const value = computed.getPropertyValue(property);
      if (value) clonedElements[index].style.setProperty(property, value);
    }
  });
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${source.getAttribute("data-filename") || "mindmap"}.svg`;
  link.click();
  URL.revokeObjectURL(href);
}

function MindmapCanvas({ map }: { map: AssistantMindmapResult }) {
  const titleId = useId();
  const descId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const { positions, edges, height } = mapPositions(map.root);

  return <section aria-label="Kết quả mindmap" className="w-full min-w-0">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 data-typography="section-title" className="text-balance text-lg font-semibold">{map.title}</h2>{map.subtitle && <p className="mt-1 text-pretty text-sm text-on-surface-variant">{map.subtitle}</p>}</div>
      <button type="button" onClick={() => { if (svgRef.current) exportSvg(svgRef.current); }} className={cn("inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}><Download className="size-4" aria-hidden="true" />Tải SVG</button>
    </div>
    <div className="overflow-auto rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:p-5">
      <svg ref={svgRef} data-filename={map.title.toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "mindmap"} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descId}`} className="h-auto min-h-96 w-full min-w-[900px]" xmlns={svgNamespace}>
        <title id={titleId}>{map.title}</title>
        <desc id={descId}>Sơ đồ tư duy gồm {map.root.children.length} nhánh chính.</desc>
        <rect x="0" y="0" width={width} height={height} className="fill-surface-container-lowest" />
        <g aria-hidden="true">{edges.map(({ parent, child }) => <path key={`${parent.depth}-${parent.branch}-${parent.node.label}-${child.node.label}`} d={edgePath(parent, child)} className={cn("fill-none", branchTones[child.branch % branchTones.length].edge)} strokeWidth={parent.depth === 0 ? 5 : 3.5} strokeLinecap="round" />)}</g>
        <g>{positions.map((position, index) => {
          const isRoot = position.depth === 0;
          const isBranch = position.depth === 1;
          const nodeHeight = isRoot ? 116 : 100;
          const nodeBoxWidth = isRoot ? 268 : nodeWidth;
          const labelLines = wrapText(position.node.label, isRoot ? 25 : 21, 2);
          const detailLines = wrapText(position.node.detail, 32, 2);
          const textHeight = labelLines.length * (isRoot ? 23 : 20) + (detailLines.length ? 9 + detailLines.length * 16 : 0);
          let textY = position.y - textHeight / 2 + (isRoot ? 18 : 16);
          const branchTone = branchTones[position.branch % branchTones.length];
          const tone = isRoot
            ? { box: "fill-primary stroke-primary", label: "fill-on-primary", detail: "fill-on-primary/85" }
            : isBranch
              ? { box: branchTone.branchBox, label: branchTone.branchLabel, detail: branchTone.branchDetail }
              : { box: branchTone.nodeBox, label: branchTone.label, detail: branchTone.detail };
          return <g key={`${position.depth}-${position.branch}-${position.node.label}-${index}`}>
            <rect x={position.x - nodeBoxWidth / 2} y={position.y - nodeHeight / 2} width={nodeBoxWidth} height={nodeHeight} rx={isRoot ? 20 : 14} className={cn(tone.box, "stroke-2")} />
            <text textAnchor="middle" className={cn(isRoot ? "text-base font-semibold" : "text-sm font-semibold", tone.label)}>
              {labelLines.map((line, lineIndex) => <tspan key={`label-${lineIndex}`} x={position.x} y={textY + lineIndex * (isRoot ? 23 : 20)}>{line}</tspan>)}
              {detailLines.map((line, lineIndex) => <tspan key={`detail-${lineIndex}`} x={position.x} y={textY + labelLines.length * (isRoot ? 23 : 20) + 9 + lineIndex * 16} className={cn("text-xs font-normal", tone.detail)}>{line}</tspan>)}
            </text>
          </g>;
        })}</g>
      </svg>
    </div>
    <ul className="sr-only" aria-label="Nội dung sơ đồ tư duy">{map.root.children.map(branch => <li key={branch.label}>{branch.label}{branch.detail && `: ${branch.detail}`}<ul>{branch.children.map(child => <li key={child.label}>{child.label}{child.detail && `: ${child.detail}`}<ul>{child.children.map(leaf => <li key={leaf.label}>{leaf.label}{leaf.detail && `: ${leaf.detail}`}</li>)}</ul></li>)}</ul></li>)}</ul>
  </section>;
}

export function AssistantStudioMindmapResult({ map }: { map: AssistantMindmapResult }) {
  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8"><MindmapCanvas map={map} /></main>;
}
