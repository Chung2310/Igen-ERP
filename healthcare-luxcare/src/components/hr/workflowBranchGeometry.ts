export interface ConnectorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BranchConnectorGeometry {
  path: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  label: { x: number; y: number };
}

export function calculateBranchConnector(
  source: ConnectorRect,
  target: ConnectorRect,
  siblingIndex: number,
  siblingCount: number,
): BranchConnectorGeometry {
  const sourceCenter = { x: source.left + source.width / 2, y: source.top + source.height / 2 };
  const targetCenter = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const offset = (siblingIndex - (siblingCount - 1) / 2) * 18;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const goesRight = dx >= 0;
    const start = { x: goesRight ? source.left + source.width : source.left, y: sourceCenter.y + offset };
    const end = { x: goesRight ? target.left : target.left + target.width, y: targetCenter.y + offset };
    const controlX = Math.max(40, Math.abs(end.x - start.x) / 2);
    const firstControlX = start.x + (goesRight ? controlX : -controlX);
    const secondControlX = end.x + (goesRight ? -controlX : controlX);
    return {
      start,
      end,
      path: `M ${start.x} ${start.y} C ${firstControlX} ${start.y}, ${secondControlX} ${end.y}, ${end.x} ${end.y}`,
      label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    };
  }

  const goesDown = dy >= 0;
  const start = { x: sourceCenter.x + offset, y: goesDown ? source.top + source.height : source.top };
  const end = { x: targetCenter.x + offset, y: goesDown ? target.top : target.top + target.height };
  const controlY = Math.max(40, Math.abs(end.y - start.y) / 2);
  const firstControlY = start.y + (goesDown ? controlY : -controlY);
  const secondControlY = end.y + (goesDown ? -controlY : controlY);
  return {
    start,
    end,
    path: `M ${start.x} ${start.y} C ${start.x} ${firstControlY}, ${end.x} ${secondControlY}, ${end.x} ${end.y}`,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
  };
}
