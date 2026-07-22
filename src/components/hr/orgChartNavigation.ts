export type OrgChartWheelAction = "pan" | "zoom";

export interface OrgChartWheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}

export interface OrgChartScrollBounds {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

const LINE_HEIGHT_PX = 16;
const TOUCHPAD_PIXEL_THRESHOLD = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_SENSITIVITY = 0.002;

export function normalizeWheelDelta(delta: number, deltaMode: number, pageSize = 800): number {
  if (!Number.isFinite(delta)) return 0;
  if (deltaMode === 1) return delta * LINE_HEIGHT_PX;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}

export function classifyOrgChartWheel(input: OrgChartWheelInput): OrgChartWheelAction {
  if (input.ctrlKey) return "zoom";
  if (input.deltaMode !== 0) return "zoom";
  if (Math.abs(input.deltaX) > 0) return "pan";
  return Math.abs(input.deltaY) < TOUCHPAD_PIXEL_THRESHOLD ? "pan" : "zoom";
}

export function calculateOrgChartZoom(currentZoom: number, deltaY: number): number {
  if (!Number.isFinite(currentZoom) || !Number.isFinite(deltaY) || deltaY === 0) {
    return Number.isFinite(currentZoom) ? currentZoom : 1;
  }

  const nextZoom = currentZoom * Math.exp(-deltaY * ZOOM_SENSITIVITY);
  return Number(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)).toFixed(3));
}

export function canScrollOrgChart(bounds: OrgChartScrollBounds, deltaX: number, deltaY: number): boolean {
  const maxLeft = Math.max(0, bounds.scrollWidth - bounds.clientWidth);
  const maxTop = Math.max(0, bounds.scrollHeight - bounds.clientHeight);
  const canMoveX = deltaX < 0 ? bounds.scrollLeft > 0 : deltaX > 0 && bounds.scrollLeft < maxLeft;
  const canMoveY = deltaY < 0 ? bounds.scrollTop > 0 : deltaY > 0 && bounds.scrollTop < maxTop;
  return canMoveX || canMoveY;
}
