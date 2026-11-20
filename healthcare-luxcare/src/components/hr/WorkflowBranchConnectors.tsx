import React, { useId, useLayoutEffect, useState } from "react";
import type { WorkflowEdge, WorkflowStep } from "../../types";
import { calculateBranchConnector, type BranchConnectorGeometry, type ConnectorRect } from "./workflowBranchGeometry";

interface WorkflowBranchConnectorsProps {
  steps: WorkflowStep[];
  edges: WorkflowEdge[];
  canvas: HTMLDivElement | null;
  nodeElements: Map<string, HTMLDivElement>;
  isDark: boolean;
  onEditSource: (stepId: string) => void;
}

interface PositionedEdge {
  edge: WorkflowEdge;
  geometry: BranchConnectorGeometry;
}

const relativeRect = (element: HTMLElement, canvasRect: DOMRect): ConnectorRect => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left - canvasRect.left, top: rect.top - canvasRect.top, width: rect.width, height: rect.height };
};

export default function WorkflowBranchConnectors({
  steps,
  edges,
  canvas,
  nodeElements,
  isDark,
  onEditSource,
}: WorkflowBranchConnectorsProps) {
  const markerId = `workflow-arrow-${useId().replace(/:/g, "")}`;
  const [positioned, setPositioned] = useState<PositionedEdge[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!canvas) return;

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const validStepIds = new Set(steps.map((step) => step.id));
      const bySource = new Map<string, WorkflowEdge[]>();
      for (const edge of edges) {
        if (!validStepIds.has(edge.source) || !validStepIds.has(edge.target)) continue;
        const group = bySource.get(edge.source) || [];
        group.push(edge);
        bySource.set(edge.source, group);
      }

      const next: PositionedEdge[] = [];
      for (const group of bySource.values()) {
        group.sort((left, right) => Number(left.priority || 0) - Number(right.priority || 0));
        group.forEach((edge, index) => {
          const source = nodeElements.get(edge.source);
          const target = nodeElements.get(edge.target);
          if (!source || !target) return;
          next.push({
            edge,
            geometry: calculateBranchConnector(
              relativeRect(source, canvasRect),
              relativeRect(target, canvasRect),
              index,
              group.length,
            ),
          });
        });
      }
      setSize({ width: canvasRect.width, height: canvasRect.height });
      setPositioned(next);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    nodeElements.forEach((element) => observer?.observe(element));
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [canvas, edges, nodeElements, steps]);

  if (!canvas || positioned.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden={false}>
      <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible">
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className={isDark ? "fill-indigo-400" : "fill-indigo-500"} />
          </marker>
        </defs>
        {positioned.map(({ edge, geometry }) => (
          <path
            key={edge.id}
            data-edge-id={edge.id}
            d={geometry.path}
            fill="none"
            stroke={isDark ? "#818cf8" : "#6366f1"}
            strokeWidth="2"
            strokeDasharray={edge.isDefault ? "6 5" : undefined}
            markerEnd={`url(#${markerId})`}
          />
        ))}
      </svg>
      {positioned.map(({ edge, geometry }) => (
        <button
          key={`label-${edge.id}`}
          type="button"
          onClick={(event) => { event.stopPropagation(); onEditSource(edge.source); }}
          className={`pointer-events-auto absolute max-w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-[9px] font-bold leading-tight shadow-sm ${isDark ? "border-indigo-500/60 bg-zinc-900 text-indigo-200" : "border-indigo-200 bg-white text-indigo-700"}`}
          style={{ left: Math.min(Math.max(48, geometry.label.x), Math.max(48, size.width - 48)), top: Math.min(Math.max(18, geometry.label.y), Math.max(18, size.height - 18)) }}
          aria-label={edge.label.trim() || "Chưa ghi điều kiện"}
        >
          {edge.label.trim() || "Chưa ghi điều kiện"}
        </button>
      ))}
    </div>
  );
}
