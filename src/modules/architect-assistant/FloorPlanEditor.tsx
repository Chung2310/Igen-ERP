import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { AppWindow, Copy, DoorOpen, Download, History, MessageCircle, Minus, PenLine, Plus, Redo2, RotateCw, Ruler, Send, Trash2, Undo2 } from "lucide-react";
import { cn } from "../student-management/lib/utils";
import type { ArchitectureFurniture, ArchitectureOpening, ArchitecturePlan, ArchitectureRoom } from "../../shared/architecture-assistant";
import ArchitecturePlan3DViewer from "./ArchitecturePlan3DViewer";

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const controlClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const furnitureCatalog = [
  { category: "Phòng khách", type: "Sofa", name: "Sofa 2 chỗ" }, { category: "Phòng khách", type: "Sofa", name: "Sofa chữ L" },
  { category: "Phòng khách", type: "Ghế", name: "Ghế bành" }, { category: "Phòng khách", type: "Bàn", name: "Bàn trà" },
  { category: "Phòng khách", type: "Kệ TV", name: "Kệ TV" }, { category: "Phòng khách", type: "Đồ nội thất khác", name: "Đèn đứng" },
  { category: "Phòng ngủ", type: "Giường", name: "Giường đơn" }, { category: "Phòng ngủ", type: "Giường", name: "Giường đôi" },
  { category: "Phòng ngủ", type: "Tủ", name: "Tủ đầu giường" }, { category: "Phòng ngủ", type: "Tủ", name: "Tủ quần áo" },
  { category: "Phòng ngủ", type: "Tủ", name: "Tủ ngăn kéo" },
  { category: "Bếp và phòng ăn", type: "Bàn", name: "Bàn ăn" }, { category: "Bếp và phòng ăn", type: "Ghế", name: "Ghế ăn" },
  { category: "Bếp và phòng ăn", type: "Bếp", name: "Tủ bếp" }, { category: "Bếp và phòng ăn", type: "Bếp", name: "Bếp nấu" },
  { category: "Bếp và phòng ăn", type: "Bếp", name: "Tủ lạnh" }, { category: "Bếp và phòng ăn", type: "Bếp", name: "Bồn rửa bát" },
  { category: "Phòng tắm", type: "Thiết bị vệ sinh", name: "Bồn cầu" }, { category: "Phòng tắm", type: "Thiết bị vệ sinh", name: "Chậu rửa mặt" },
  { category: "Phòng tắm", type: "Thiết bị vệ sinh", name: "Bồn tắm" }, { category: "Phòng tắm", type: "Thiết bị vệ sinh", name: "Vòi hoa sen" }, { category: "Phòng tắm", type: "Gương", name: "Gương phòng tắm" },
  { category: "Làm việc", type: "Bàn làm việc", name: "Bàn làm việc" }, { category: "Làm việc", type: "Ghế", name: "Ghế làm việc" },
  { category: "Giặt giũ và gara", type: "Thiết bị", name: "Máy giặt" }, { category: "Giặt giũ và gara", type: "Xe", name: "Ô tô" },
  { category: "Lối vào và giặt giũ", type: "Ghế", name: "Ghế băng" }, { category: "Lối vào và giặt giũ", type: "Móc treo", name: "Móc treo quần áo" },
  { category: "Lối vào và giặt giũ", type: "Bàn phụ", name: "Bàn phụ có gương" }, { category: "Lối vào và giặt giũ", type: "Thiết bị", name: "Máy giặt sấy" },
  { category: "Lối vào và giặt giũ", type: "Chậu giặt", name: "Chậu giặt" }, { category: "Nhà xe và kho", type: "Giá treo", name: "Giá treo quần áo" },
  { category: "Nhà xe và kho", type: "Đồ dùng", name: "Đồ dùng khác" }, { category: "Nhà xe và kho", type: "Thiết bị", name: "Cục nóng điều hòa" },
  { category: "Nhà xe và kho", type: "Thiết bị", name: "Máy nước nóng" },
  { category: "Phòng gym", type: "Thiết bị tập", name: "Xe đạp tập thể dục" }, { category: "Phòng gym", type: "Thiết bị tập", name: "Ghế tập gym" },
  { category: "Phòng gym", type: "Thiết bị tập", name: "Máy chạy bộ" }, { category: "Phòng gym", type: "Thiết bị tập", name: "Giá để tạ" }, { category: "Phòng gym", type: "Thảm tập", name: "Thảm tập yoga" },
  { category: "Phòng khách", type: "Kệ", name: "Kệ sách" }, { category: "Phòng khách", type: "Tủ", name: "Tủ kệ trang trí" }, { category: "Phòng khách", type: "Bàn", name: "Bàn phụ, bàn góc" },
  { category: "Phòng làm việc", type: "Tủ hồ sơ", name: "Tủ tài liệu" },
  { category: "Ngoài trời", type: "Bếp nướng", name: "Bếp nướng BBQ" }, { category: "Ngoài trời", type: "Ghế thư giãn", name: "Ghế nằm thư giãn" },
  { category: "Ngoài trời", type: "Bàn ghế", name: "Bộ bàn ghế ngoài trời" }, { category: "Giải trí", type: "Bàn giải trí", name: "Bàn bi-a" },
  { category: "Khác", type: "Cầu thang", name: "Cầu thang" }, { category: "Khác", type: "Cây cảnh", name: "Chậu cây" },
  { category: "Khác", type: "Đồ nội thất khác", name: "Đồ nội thất khác" },
];
const furnitureMaterials = [
  { value: "natural_oak", name: "Gỗ sồi tự nhiên", color: "#c8a578" },
  { value: "dark_walnut", name: "Gỗ óc chó", color: "#5c4033" },
  { value: "painted_white", name: "Sơn trắng", color: "#f2f0e9" },
  { value: "fabric_grey", name: "Vải xám", color: "#87929b" },
  { value: "fabric_green", name: "Vải xanh", color: "#426954" },
  { value: "beige_fabric", name: "Vải be", color: "#c6b79f" },
  { value: "marble", name: "Đá cẩm thạch", color: "#d4d9dc" },
  { value: "stainless_steel", name: "Thép không gỉ", color: "#aab4ba" },
  { value: "black_metal", name: "Kim loại đen", color: "#343a3d" },
];
function furnitureVariants(item: Pick<ArchitectureFurniture, "type" | "name">) {
  const value = `${item.type} ${item.name}`.toLocaleLowerCase("vi");
  if (/sofa/.test(value)) return [{ value: "two_seater", label: "Sofa 2 chỗ" }, { value: "three_seater", label: "Sofa 3 chỗ" }, { value: "sectional", label: "Sofa góc chữ L" }];
  if (/giường|crib|bed/.test(value)) return [{ value: "twin", label: "Giường đơn (Twin)" }, { value: "full", label: "Giường đôi (Full)" }, { value: "queen", label: "Giường Queen" }, { value: "king", label: "Giường King" }, { value: "cal_king", label: "Giường Cal-King" }, { value: "crib", label: "Cũi em bé" }];
  if (/bồn tắm/.test(value)) return [{ value: "jacuzzi", label: "Bồn tắm xây, Jacuzzi" }, { value: "freestanding", label: "Bồn tắm độc lập" }];
  if (/vòi hoa sen|vòi sen/.test(value)) return [{ value: "large", label: "Vòi sen lớn" }, { value: "medium", label: "Vòi sen vừa" }, { value: "small", label: "Vòi sen nhỏ" }];
  if (/chậu rửa mặt/.test(value)) return [{ value: "single", label: "Chậu đơn" }, { value: "double", label: "Chậu đôi" }];
  if (/bếp nấu/.test(value)) return [{ value: "built_in", label: "Bếp âm" }];
  if (/tủ lạnh/.test(value)) return [{ value: "side_by_side", label: "Side by Side" }];
  if (/bàn làm việc/.test(value)) return [{ value: "standard", label: "Bàn đơn" }, { value: "executive", label: "Bàn giám đốc" }, { value: "l_shape", label: "Bàn góc chữ L" }];
  if (/máy giặt sấy/.test(value)) return [{ value: "side_by_side", label: "Đặt song song" }, { value: "stacked", label: "Đặt xếp chồng" }];
  if (/ô tô/.test(value)) return [{ value: "sedan", label: "Xe Sedan" }, { value: "suv", label: "Xe SUV" }];
  if (/cầu thang/.test(value)) return [{ value: "straight", label: "Thẳng" }, { value: "l_shaped_landing", label: "Chữ L, chiếu nghỉ" }, { value: "l_shaped_winder", label: "Chữ L, bậc xoay" }, { value: "u_shaped", label: "Chữ U" }];
  return [];
}
function furnitureDisplayColor(item: Pick<ArchitectureFurniture, "material" | "color">) {
  return item.color || furnitureMaterials.find(material => material.value === item.material)?.color;
}
const quickRoomTypes = ["Phòng khách", "Phòng bếp", "Phòng ăn", "Phòng ngủ", "Phòng tắm", "WC phụ", "Phòng làm việc", "Phòng sinh hoạt chung", "Ban công", "Sân thượng", "Gara", "Phòng giặt"];
const defaultRoomCounts: Record<string, number> = { "Phòng khách": 1, "Phòng bếp": 1, "Phòng ăn": 1, "Phòng ngủ": 0, "Phòng tắm": 1, "WC phụ": 0, "Phòng làm việc": 0, "Phòng sinh hoạt chung": 0, "Ban công": 0, "Sân thượng": 0, "Gara": 1, "Phòng giặt": 0 };
const finishChoices = {
  flooring: ["Gỗ sáng", "Gỗ tối", "Gạch đá", "Terrazzo", "Bê tông mài"],
  walls: ["Trắng ấm", "Trắng lạnh", "Màu kem", "Xám nhạt", "Xanh nhạt", "Xanh olive"],
  ceiling: ["Trắng", "Trắng ấm", "Xám nhạt", "Gỗ trang trí"],
  doors: ["Gỗ tự nhiên", "Gỗ sơn trắng", "Nhôm kính", "Gỗ tối"],
  windows: ["Kính trong, khung nhôm", "Kính mờ", "Khung nhôm đen", "Khung gỗ"],
} as const;
const openingWalls: Array<{ value: ArchitectureOpening["wall"]; label: string }> = [
  { value: "north", label: "Tường trên" }, { value: "east", label: "Tường phải" },
  { value: "south", label: "Tường dưới" }, { value: "west", label: "Tường trái" },
];

function makeRoom(floor: number): ArchitectureRoom {
  return { id: crypto.randomUUID(), name: "Phòng mới", floor, x: 10, y: 10, width: 22, height: 20, areaM2: 12 };
}

const outlineTemplates: Record<string, NonNullable<ArchitecturePlan["outline"]>> = {
  "Hình chữ nhật": [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  "Hình chữ L": [{ x: 0, y: 0 }, { x: 65, y: 0 }, { x: 65, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  "Hình chữ U": [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 80 }, { x: 30, y: 80 }, { x: 30, y: 100 }, { x: 0, y: 100 }],
  "Hình chữ T": [{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 75, y: 35 }, { x: 100, y: 35 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 35 }, { x: 25, y: 35 }],
  "Hình chữ H": [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 25 }, { x: 70, y: 25 }, { x: 70, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 75 }, { x: 30, y: 75 }, { x: 30, y: 100 }, { x: 0, y: 100 }],
  "Hình chữ thập": [{ x: 30, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 70 }, { x: 70, y: 70 }, { x: 70, y: 100 }, { x: 30, y: 100 }, { x: 30, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 30 }, { x: 30, y: 30 }],
};

function pointInsideOutline(point: { x: number; y: number }, outline: NonNullable<ArchitecturePlan["outline"]>) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const a = outline[index]; const b = outline[previous];
    const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) - 1e-7 && point.x <= Math.max(a.x, b.x) + 1e-7 && point.y >= Math.min(a.y, b.y) - 1e-7 && point.y <= Math.max(a.y, b.y) + 1e-7) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function roomFitsOutline(room: ArchitectureRoom, outline: NonNullable<ArchitecturePlan["outline"]>) {
  const points = [
    { x: room.x, y: room.y }, { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.height }, { x: room.x, y: room.y + room.height },
    { x: room.x + room.width / 2, y: room.y + room.height / 2 },
  ];
  if (points.some(point => !pointInsideOutline(point, outline))) return false;
  return !outline.some(point => point.x > room.x + 0.01 && point.x < room.x + room.width - 0.01 && point.y > room.y + 0.01 && point.y < room.y + room.height - 0.01);
}

function roomsOverlap(left: ArchitectureRoom, right: ArchitectureRoom) {
  return left.floor === right.floor && left.x < right.x + right.width - 0.01 && left.x + left.width > right.x + 0.01 && left.y < right.y + right.height - 0.01 && left.y + left.height > right.y + 0.01;
}

function shapeFromOutline(outline?: ArchitecturePlan["outline"]) {
  if (!outline) return "Hình chữ nhật";
  const signature = (points: NonNullable<ArchitecturePlan["outline"]>) => points.map(point => `${point.x},${point.y}`).join(";");
  return Object.entries(outlineTemplates).find(([, points]) => signature(points) === signature(outline))?.[0] || "Tùy chỉnh";
}

function outlineHasSelfIntersection(points: Array<{ x: number; y: number }>) {
  const orientation = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(cross) < 1e-7 ? 0 : Math.sign(cross);
  };
  const onSegment = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    c.x >= Math.min(a.x, b.x) - 1e-7 && c.x <= Math.max(a.x, b.x) + 1e-7 && c.y >= Math.min(a.y, b.y) - 1e-7 && c.y <= Math.max(a.y, b.y) + 1e-7;
  const intersects = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
    const abC = orientation(a, b, c); const abD = orientation(a, b, d); const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
    if (abC * abD < 0 && cdA * cdB < 0) return true;
    return (abC === 0 && onSegment(a, b, c)) || (abD === 0 && onSegment(a, b, d)) || (cdA === 0 && onSegment(c, d, a)) || (cdB === 0 && onSegment(c, d, b));
  };
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (firstNext === second || secondNext === first) continue;
      if (intersects(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

function makeRoomForOutline(floor: number, outline?: ArchitecturePlan["outline"], existing: ArchitectureRoom[] = []) {
  const base = makeRoom(floor);
  const isValid = (room: ArchitectureRoom) => (!outline || roomFitsOutline(room, outline)) && !existing.some(item => roomsOverlap(room, item));
  if (isValid(base)) return base;
  for (let y = 4; y <= 76; y += 4) {
    for (let x = 4; x <= 76; x += 4) {
      const candidate = { ...base, x, y };
      if (isValid(candidate)) return candidate;
    }
  }
  return { ...base, x: 40, y: 40 };
}

export function ArchitecturePlanSvg({ plan, floor = 1 }: { plan: ArchitecturePlan; floor?: number }) {
  const rooms = plan.rooms.filter(room => room.floor === floor);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Sơ đồ mặt bằng 2D" className="aspect-square w-full rounded-lg border border-outline-variant bg-surface-container-lowest">
      <defs><pattern id="architecture-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-outline-variant)" strokeWidth="0.18" /></pattern>{plan.outline && <clipPath id="architecture-read-boundary-clip"><polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} /></clipPath>}</defs>
      <rect width="100" height="100" fill="url(#architecture-grid)" />
      {plan.outline && <polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} fill="var(--color-surface-container-low)" stroke="var(--color-primary)" strokeWidth="0.8" />}
      <g clipPath={plan.outline ? "url(#architecture-read-boundary-clip)" : undefined}>
      {rooms.map(room => <g key={room.id}>
        <rect x={room.x} y={room.y} width={room.width} height={room.height} rx="0.6" fill="var(--color-surface-container)" stroke="var(--color-outline)" strokeWidth="0.7" />
        <text x={room.x + room.width / 2} y={room.y + room.height / 2 - 1} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="3.4" pointerEvents="none">{room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}</text>
        <text x={room.x + room.width / 2} y={room.y + room.height / 2 + 3} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface-variant)" fontSize="2.6" pointerEvents="none">{room.areaM2} m²</text>
      </g>)}
      </g>
      {!rooms.length && <text x="50" y="51" textAnchor="middle" fill="var(--color-on-surface-variant)" fontSize="4">Thêm phòng để bắt đầu</text>}
    </svg>
  );
}

export function ArchitecturePlanIsometric({ plan, floor = 1 }: { plan: ArchitecturePlan; floor?: number }) {
  const rooms = plan.rooms.filter(room => room.floor === floor);
  const project = (x: number, y: number, z = 0) => [60 + (x - y) * 0.46, 15 + (x + y) * 0.23 - z] as const;
  const points = (coordinates: readonly (readonly [number, number])[]) => coordinates.map(([x, y]) => `${x},${y}`).join(" ");
  return <svg viewBox="0 0 120 86" role="img" aria-label={`Mô hình khối 3D minh họa tầng ${floor}`} className="aspect-[1.4] w-full rounded-lg border border-outline-variant bg-surface-container-lowest">
    {rooms.map(room => {
      const lower = [project(room.x, room.y), project(room.x + room.width, room.y), project(room.x + room.width, room.y + room.height), project(room.x, room.y + room.height)] as const;
      const upper = [project(room.x, room.y, 12), project(room.x + room.width, room.y, 12), project(room.x + room.width, room.y + room.height, 12), project(room.x, room.y + room.height, 12)] as const;
      const center = project(room.x + room.width / 2, room.y + room.height / 2, 12);
      const items = (plan.furniture || []).filter(item => item.roomId === room.id);
      return <g key={room.id}>
        <polygon points={points([lower[1], lower[2], upper[2], upper[1]])} fill="color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-container))" stroke="var(--color-outline)" strokeWidth="0.45" />
        <polygon points={points([lower[2], lower[3], upper[3], upper[2]])} fill="color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-container))" stroke="var(--color-outline)" strokeWidth="0.45" />
        <polygon points={points(upper)} fill="var(--color-surface-container-lowest)" stroke="var(--color-outline)" strokeWidth="0.5" />
        {items.map(item => { const p = project(room.x + ((item.x + item.width / 2) / 100) * room.width, room.y + ((item.y + item.height / 2) / 100) * room.height, 13); return <rect key={item.id} x={p[0] - 1.2} y={p[1] - 0.6} width="2.4" height="1.2" rx="0.2" fill="var(--color-primary)" opacity="0.8" />; })}
        <text x={center[0]} y={center[1]} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="2.5">{room.name}</text>
      </g>;
    })}
    {!rooms.length && <text x="60" y="43" textAnchor="middle" fill="var(--color-on-surface-variant)" fontSize="3.6">Chưa có phòng ở tầng này</text>}
  </svg>;
}

type Gesture = { pointerId: number; type: "room-move" | "room-resize" | "furniture-move"; id: string; startX: number; startY: number; original: ArchitecturePlan };
type PanGesture = { pointerId: number; clientX: number; clientY: number; initialX: number; initialY: number };

function suggestedFurniture(name: string) {
  const value = name.toLocaleLowerCase("vi");
  if (/ngủ|bedroom/.test(value)) return [{ type: "Giường", name: "Giường đôi" }, { type: "Tủ", name: "Tủ quần áo" }, { type: "Tủ", name: "Tủ đầu giường" }, { type: "Tủ", name: "Tủ ngăn kéo" }];
  if (/khách|sinh hoạt|living/.test(value)) return [{ type: "Sofa", name: "Sofa 3 chỗ" }, { type: "Kệ TV", name: "Kệ TV" }, { type: "Ghế", name: "Ghế bành" }, { type: "Bàn", name: "Bàn trà" }, { type: "Kệ", name: "Kệ sách" }];
  if (/bếp|ăn|kitchen|dining/.test(value)) return [{ type: "Bếp", name: "Tủ bếp" }, { type: "Bếp", name: "Bếp nấu" }, { type: "Bếp", name: "Bồn rửa bát" }, { type: "Bếp", name: "Tủ lạnh" }, { type: "Bàn", name: "Bàn ăn" }];
  if (/tắm|vệ sinh|wc|bath/.test(value)) return [{ type: "Thiết bị vệ sinh", name: "Bồn cầu" }, { type: "Thiết bị vệ sinh", name: "Chậu rửa mặt" }, { type: "Thiết bị vệ sinh", name: "Vòi hoa sen" }, { type: "Gương", name: "Gương phòng tắm" }];
  if (/giặt|laundry/.test(value)) return [{ type: "Thiết bị", name: "Máy giặt sấy" }, { type: "Chậu giặt", name: "Chậu giặt" }, { type: "Tủ", name: "Tủ lưu trữ" }];
  if (/gara|garage|nhà xe|kho/.test(value)) return [{ type: "Xe", name: "Ô tô" }, { type: "Giá treo", name: "Giá treo quần áo" }, { type: "Đồ dùng", name: "Đồ dùng khác" }, { type: "Thiết bị", name: "Cục nóng điều hòa" }];
  if (/gym|thể thao/.test(value)) return [{ type: "Thiết bị tập", name: "Máy chạy bộ" }, { type: "Thiết bị tập", name: "Xe đạp tập thể dục" }, { type: "Thảm tập", name: "Thảm tập yoga" }, { type: "Thiết bị tập", name: "Giá để tạ" }];
  if (/ngoài trời|sân|ban công|outdoor/.test(value)) return [{ type: "Bàn nướng", name: "Bếp nướng BBQ" }, { type: "Ghế thư giãn", name: "Ghế nằm thư giãn" }, { type: "Bàn ghế", name: "Bộ bàn ghế ngoài trời" }, { type: "Cây cảnh", name: "Chậu cây" }];
  if (/làm việc|office/.test(value)) return [{ type: "Bàn làm việc", name: "Bàn làm việc" }, { type: "Ghế", name: "Ghế làm việc" }, { type: "Tủ hồ sơ", name: "Tủ tài liệu" }];
  return [{ type: "Bàn làm việc", name: "Bàn làm việc" }, { type: "Ghế", name: "Ghế làm việc" }, { type: "Tủ", name: "Tủ lưu trữ" }];
}

export default function FloorPlanEditor({ plan, onChange, disabled = false, floor = 1, floorsCount = 1, canGenerateAi = false, canAskAi = false, rendering = false, aiGenerating = false, generationError = "", onGeneratePlan, onGenerate3DRender }: {
  plan: ArchitecturePlan;
  onChange: (plan: ArchitecturePlan) => void;
  disabled?: boolean;
  floor?: number;
  floorsCount?: number;
  canGenerateAi?: boolean;
  canAskAi?: boolean;
  rendering?: boolean;
  aiGenerating?: boolean;
  generationError?: string;
  onGeneratePlan?: (prompt: string, outline: NonNullable<ArchitecturePlan["outline"]>) => void;
  onGenerate3DRender?: (image: string, mode: "interior" | "floorplan", aspectRatio: "4:3" | "16:9" | "1:1") => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string>();
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [newFurnitureType, setNewFurnitureType] = useState(furnitureCatalog[0].name);
  const [furnitureSearch, setFurnitureSearch] = useState("");
  const [history, setHistory] = useState<ArchitecturePlan[]>([]);
  const [redoHistory, setRedoHistory] = useState<ArchitecturePlan[]>([]);
  const [assistantTab, setAssistantTab] = useState<"chat" | "history">("chat");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [showDimensions, setShowDimensions] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [exportError, setExportError] = useState("");
  const [drawingRoom, setDrawingRoom] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [drawRoomName, setDrawRoomName] = useState("Phòng mới");
  const [drawPointX, setDrawPointX] = useState(10);
  const [drawPointY, setDrawPointY] = useState(10);
  const [drawError, setDrawError] = useState("");
  const [quickShape, setQuickShape] = useState(() => shapeFromOutline(plan.outline));
  const [quickFloor, setQuickFloor] = useState(floor);
  const [quickRoomsByFloor, setQuickRoomsByFloor] = useState<Record<number, Record<string, number>>>({});
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "assistant" | "user"; text: string; pending?: boolean }>>([
    { role: "assistant", text: "Mô tả công năng, diện tích từng khu vực hoặc thay đổi bạn muốn. AI sẽ đề xuất phương án mặt bằng để bạn tiếp tục chỉnh sửa." },
  ]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingXRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const floorRooms = plan.rooms.filter(room => room.floor === floor);
  const filteredFurnitureCatalog = furnitureCatalog.filter(item => `${item.name} ${item.category}`.toLocaleLowerCase("vi").includes(furnitureSearch.trim().toLocaleLowerCase("vi")));
  const selected = floorRooms.find(room => room.id === selectedId) || floorRooms[0];
  const selectedFurniture = (plan.furniture || []).find(item => item.id === selectedFurnitureId && item.roomId === selected?.id);
  const selectedFurnitureVariants = selectedFurniture ? furnitureVariants(selectedFurniture) : [];
  const selectedOpening = (plan.openings || []).find(item => item.id === selectedOpeningId && item.roomId === selected?.id);
  const remember = (previous = plan) => { setHistory(items => [...items.slice(-29), structuredClone(previous)]); setRedoHistory([]); };
  const currentOutlineSignature = plan.outline?.map(point => `${point.x},${point.y}`).join(";") || "";

  useEffect(() => setQuickFloor(floor), [floor]);
  useEffect(() => setQuickShape(shapeFromOutline(plan.outline)), [currentOutlineSignature]);
  useEffect(() => { if (drawingRoom) drawingXRef.current?.focus(); }, [drawingRoom]);

  useEffect(() => {
    if (aiGenerating) return;
    setAssistantMessages(messages => {
      if (!messages.some(message => message.pending)) return messages;
      return messages.map(message => message.pending ? {
        ...message,
        pending: false,
        text: generationError ? `Chưa tạo được mặt bằng: ${generationError}` : "Phương án mặt bằng đã được cập nhật. Bạn có thể kéo thả phòng và tinh chỉnh thông số bên cạnh.",
      } : message);
    });
  }, [aiGenerating, generationError]);

  const submitAssistantPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userPrompt = assistantPrompt.trim();
    const configuredFloors = Object.keys(quickRoomsByFloor).map(Number);
    const floorsToSummarize = configuredFloors.length ? configuredFloors : [quickFloor];
    const defaultCountsForFloor = (targetFloor: number) => targetFloor === 1 ? defaultRoomCounts : { ...defaultRoomCounts, "Phòng ngủ": 2, "Phòng khách": 0, "Phòng bếp": 0, "Phòng ăn": 0, "Gara": 0, "Phòng sinh hoạt chung": 1, "Ban công": 1, "Phòng làm việc": 1 };
    const roomSummaries = floorsToSummarize.map(targetFloor => {
      const counts = quickRoomsByFloor[targetFloor] || defaultCountsForFloor(targetFloor);
      const roomSummary = quickRoomTypes.filter(name => (counts[name] || 0) > 0).map(name => `${counts[name]} ${name}`).join(", ");
      return roomSummary ? `Tầng ${targetFloor}: ${roomSummary}` : "";
    }).filter(Boolean).join("; ");
    const quickSummary = [`Hình dạng mặt bằng ưu tiên: ${quickShape}.`, roomSummaries ? `Bố trí công năng: ${roomSummaries}.` : ""]
      .filter(Boolean).join(" ");
    const prompt = [userPrompt, quickSummary].filter(Boolean).join(" ").slice(0, 1200);
    if (!prompt || !onGeneratePlan || !canAskAi || aiGenerating) return;
    setAssistantMessages(messages => [...messages, { role: "user", text: prompt }, { role: "assistant", text: "Đang tạo phương án theo yêu cầu này…", pending: true }]);
    setAssistantPrompt("");
    const outline = quickShape === "Tùy chỉnh" && plan.outline ? plan.outline : outlineTemplates[quickShape] || outlineTemplates["Hình chữ nhật"];
    onGeneratePlan(prompt, outline);
  };

  const updateRoom = (id: string, changes: Partial<ArchitectureRoom>) => {
    const candidate = plan.rooms.find(room => room.id === id);
    if (!candidate) return;
    const updated = { ...candidate, ...changes };
    if (plan.outline && !roomFitsOutline(updated, plan.outline)) return;
    if (plan.rooms.some(room => room.id !== id && roomsOverlap(updated, room))) return;
    onChange({ ...plan, rooms: plan.rooms.map(room => room.id === id ? updated : room) });
  };
  const updateFurniture = (id: string, changes: Partial<ArchitectureFurniture>) => onChange({ ...plan, furniture: (plan.furniture || []).map(item => item.id === id ? { ...item, ...changes } : item) });
  const updateOpening = (id: string, changes: Partial<ArchitectureOpening>) => onChange({ ...plan, openings: (plan.openings || []).map(item => item.id === id ? { ...item, ...changes } : item) });
  const undo = () => { const previous = history.at(-1); if (!previous) return; setRedoHistory(items => [...items, structuredClone(plan)]); onChange(previous); setHistory(items => items.slice(0, -1)); };
  const redo = () => { const next = redoHistory.at(-1); if (!next) return; setHistory(items => [...items, structuredClone(plan)]); onChange(next); setRedoHistory(items => items.slice(0, -1)); };
  const handleHistoryShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    const key = event.key.toLocaleLowerCase();
    if (key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if (key === "y") { event.preventDefault(); redo(); }
  };

  const addFurniture = (room: ArchitectureRoom, type: string, name?: string, x = 16, y = 18) => {
    const items = plan.furniture || [];
    if (items.length >= 400 || items.filter(item => item.roomId === room.id).length >= 40) return;
    remember();
    const item: ArchitectureFurniture = { id: crypto.randomUUID(), roomId: room.id, type, name: name || type, x, y, width: 25, height: 20, rotation: 0 };
    onChange({ ...plan, furniture: [...items, item] }); setSelectedFurnitureId(item.id); setSelectedOpeningId(undefined);
  };
  const addOpening = (room: ArchitectureRoom, type: ArchitectureOpening["type"]) => {
    const openings = plan.openings || [];
    if (openings.length >= 200) return;
    remember();
    const opening: ArchitectureOpening = { id: crypto.randomUUID(), roomId: room.id, type, wall: "north", offset: 50, width: type === "door" ? 22 : 28 };
    onChange({ ...plan, openings: [...openings, opening] }); setSelectedOpeningId(opening.id); setSelectedFurnitureId(undefined);
  };

  const planPoint = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    return { x: (rawX - 50 - pan.x) / zoom + 50, y: (rawY - 50 - pan.y) / zoom + 50 };
  };
  const beginPan = (event: PointerEvent<SVGRectElement>) => {
    if (disabled || drawingRoom || !svgRef.current) return;
    event.preventDefault();
    svgRef.current.setPointerCapture(event.pointerId);
    panGestureRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, initialX: pan.x, initialY: pan.y };
    setSelectedId(undefined); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined);
  };
  const cancelRoomDrawing = () => { setDrawingRoom(false); setDrawingPoints([]); setDrawError(""); };
  const finishRoomDrawing = (points = drawingPoints) => {
    if (disabled || !drawingRoom) return;
    if (points.length < 3) { setDrawError("Đặt ít nhất 3 điểm để tạo phòng."); return; }
    if (outlineHasSelfIntersection(points)) { setDrawError("Các cạnh đang giao nhau. Hãy lùi điểm cuối hoặc vẽ lại đường bao."); return; }
    const polygonArea = Math.abs(points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2);
    if (polygonArea < 8) { setDrawError("Vùng phòng quá nhỏ. Hãy chọn thêm các điểm để mở rộng đường bao."); return; }
    const xs = points.map(point => point.x); const ys = points.map(point => point.y);
    const x = Math.min(...xs); const y = Math.min(...ys); const width = Math.max(...xs) - x; const height = Math.max(...ys) - y;
    if (width < 4 || height < 4) { setDrawError("Phòng quá nhỏ. Hãy vẽ vùng rộng ít nhất 4% theo mỗi chiều."); return; }
    if (plan.rooms.length >= 40) { setDrawError("Đã đạt giới hạn 40 phòng trong mặt bằng."); return; }
    const areaM2 = Math.max(0.1, Math.round((width * height * 12 / 440) * 10) / 10);
    const room: ArchitectureRoom = { id: crypto.randomUUID(), name: drawRoomName.trim().slice(0, 80) || "Phòng mới", floor, x, y, width, height, areaM2 };
    if (plan.outline && !roomFitsOutline(room, plan.outline)) { setDrawError("Phòng cần nằm hoàn toàn bên trong ranh giới mặt bằng."); return; }
    if (plan.rooms.some(existing => roomsOverlap(room, existing))) { setDrawError("Phòng đang chồng lên phòng khác. Hãy vẽ lại ở vùng trống."); return; }
    remember();
    onChange({ ...plan, rooms: [...plan.rooms, room] });
    setSelectedId(room.id); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined);
    setDrawingRoom(false); setDrawingPoints([]); setDrawError("");
  };
  const addDrawingPoint = (point: { x: number; y: number }) => {
    if (!drawingRoom) return;
    const snapped = { x: Math.max(1, Math.min(99, Math.round(point.x))), y: Math.max(1, Math.min(99, Math.round(point.y))) };
    if (drawingPoints.length >= 3 && Math.hypot(snapped.x - drawingPoints[0].x, snapped.y - drawingPoints[0].y) <= 2) {
      finishRoomDrawing();
      return;
    }
    const last = drawingPoints.at(-1);
    if (last && Math.hypot(snapped.x - last.x, snapped.y - last.y) < 2) return;
    setDrawError(""); setDrawingPoints(points => [...points, snapped]); setDrawPointX(snapped.x); setDrawPointY(snapped.y);
  };
  const handleDrawingKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!drawingRoom) return;
    if (event.key === "Escape") { event.preventDefault(); cancelRoomDrawing(); }
    if (event.key === "Enter") { event.preventDefault(); finishRoomDrawing(); }
    if (event.key === "Backspace") { event.preventDefault(); setDrawingPoints(points => points.slice(0, -1)); setDrawError(""); }
  };
  const exportFloorplanPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    setExportError("");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const theme = getComputedStyle(document.documentElement);
    const themeTokens = ["outline-variant", "primary", "surface-container", "primary-container", "outline", "on-surface", "on-surface-variant", "surface-container-lowest", "secondary-container", "tertiary"];
    for (const token of themeTokens) clone.style.setProperty(`--color-${token}`, theme.getPropertyValue(`--color-${token}`).trim());
    const backgroundColor = theme.getPropertyValue("--color-surface-container-lowest").trim() || "#ffffff";
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", "100"); background.setAttribute("height", "100"); background.setAttribute("fill", backgroundColor);
    clone.insertBefore(background, clone.children[1] || null);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("width", "2048"); clone.setAttribute("height", "2048");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 2048;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Không tạo được vùng xuất ảnh.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const link = document.createElement("a"); link.download = `mat-bang-tang-${floor}.png`; link.href = canvas.toDataURL("image/png"); link.click();
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Không thể xuất ảnh PNG.");
      } finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); setExportError("Không thể tạo ảnh PNG từ bản vẽ này."); };
    image.src = url;
  };
  const beginGesture = (event: PointerEvent<SVGElement>, type: Gesture["type"], id: string) => {
    if (disabled || !svgRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const point = planPoint(event);
    gestureRef.current = { pointerId: event.pointerId, type, id, startX: point.x, startY: point.y, original: structuredClone(plan) };
    svgRef.current.setPointerCapture(event.pointerId);
    if (type === "furniture-move") { setSelectedFurnitureId(id); setSelectedOpeningId(undefined); }
    else { setSelectedId(id); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined); }
  };
  const moveGesture = (event: PointerEvent<SVGSVGElement>) => {
    const panGesture = panGestureRef.current;
    if (panGesture?.pointerId === event.pointerId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = rect.width ? 100 / rect.width : 1; const scaleY = rect.height ? 100 / rect.height : 1;
      setPan({ x: panGesture.initialX + (event.clientX - panGesture.clientX) * scaleX, y: panGesture.initialY + (event.clientY - panGesture.clientY) * scaleY });
      return;
    }
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !svgRef.current) return;
    const point = planPoint(event);
    const dx = point.x - gesture.startX; const dy = point.y - gesture.startY;
    if (gesture.type.startsWith("room-")) {
      const base = gesture.original.rooms.find(room => room.id === gesture.id);
      if (!base) return;
      const width = gesture.type === "room-resize" ? Math.max(4, Math.min(100 - base.x, base.width + dx)) : base.width;
      const height = gesture.type === "room-resize" ? Math.max(4, Math.min(100 - base.y, base.height + dy)) : base.height;
      const x = gesture.type === "room-move" ? Math.max(0, Math.min(100 - base.width, base.x + dx)) : base.x;
      const y = gesture.type === "room-move" ? Math.max(0, Math.min(100 - base.height, base.y + dy)) : base.y;
      const areaM2 = Math.max(0.1, Math.round(base.areaM2 * width * height / (base.width * base.height) * 10) / 10);
      const updatedRoom = { ...base, x, y, width, height, areaM2 };
      if (gesture.original.outline && !roomFitsOutline(updatedRoom, gesture.original.outline)) return;
      if (gesture.original.rooms.some(room => room.id !== base.id && roomsOverlap(updatedRoom, room))) return;
      onChange({ ...gesture.original, rooms: gesture.original.rooms.map(room => room.id === base.id ? updatedRoom : room) });
    } else {
      const base = gesture.original.furniture?.find(item => item.id === gesture.id);
      const room = gesture.original.rooms.find(item => item.id === base?.roomId);
      if (!base || !room) return;
      const x = Math.max(0, Math.min(100 - base.width, base.x + dx / room.width * 100));
      const y = Math.max(0, Math.min(100 - base.height, base.y + dy / room.height * 100));
      onChange({ ...gesture.original, furniture: gesture.original.furniture?.map(item => item.id === base.id ? { ...item, x, y } : item) });
    }
  };
  const endGesture = (event: PointerEvent<SVGSVGElement>) => {
    if (panGestureRef.current?.pointerId === event.pointerId) { panGestureRef.current = null; return; }
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setHistory(items => [...items.slice(-29), gesture.original]); setRedoHistory([]); gestureRef.current = null;
  };
  const adjustZoom = (amount: number) => setZoom(current => Math.max(0.2, Math.min(4, Math.round((current + amount) * 10) / 10)));
  const openingSegment = (room: ArchitectureRoom, opening: ArchitectureOpening) => {
    const half = Math.min(opening.width, 100) / 2; const start = Math.max(0, Math.min(100, opening.offset - half)); const end = Math.max(0, Math.min(100, opening.offset + half));
    if (opening.wall === "north" || opening.wall === "south") { const y = room.y + (opening.wall === "south" ? room.height : 0); return { x1: room.x + start / 100 * room.width, y1: y, x2: room.x + end / 100 * room.width, y2: y }; }
    const x = room.x + (opening.wall === "east" ? room.width : 0); return { x1: x, y1: room.y + start / 100 * room.height, x2: x, y2: room.y + end / 100 * room.height };
  };

  return (
    <div className="grid overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm xl:grid-cols-[19rem_minmax(0,1fr)_minmax(18rem,0.8fr)]" onKeyDown={handleHistoryShortcut}>
      <aside className="flex min-h-[520px] flex-col border-b border-outline-variant bg-surface-container-low xl:border-b-0 xl:border-r">
        <div className="grid grid-cols-2 border-b border-outline-variant bg-surface-container-lowest" role="group" aria-label="Trợ lý mặt bằng">
          <button type="button" aria-pressed={assistantTab === "chat"} onClick={() => setAssistantTab("chat")} className={cn("inline-flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 text-xs font-bold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-primary", assistantTab === "chat" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-container-low") }><MessageCircle className="size-4" aria-hidden="true" />Trò chuyện AI</button>
          <button type="button" aria-pressed={assistantTab === "history"} onClick={() => setAssistantTab("history")} className={cn("inline-flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 text-xs font-bold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-primary", assistantTab === "history" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:bg-surface-container-low") }><History className="size-4" aria-hidden="true" />Lịch sử</button>
        </div>
        {assistantTab === "chat" ? <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Trao đổi với trợ lý mặt bằng" aria-live="polite">
            {assistantMessages.map((message, index) => <div key={`${message.role}-${index}`} className={cn("max-w-[94%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed", message.role === "assistant" ? "rounded-tl-sm bg-surface-container-lowest text-on-surface shadow-sm" : "ml-auto rounded-tr-sm bg-primary text-on-primary") }>{message.pending && <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-primary align-middle" />}{message.text}</div>)}
            {!canAskAi && <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">Cần quyền architect-ai:manage để gửi yêu cầu cho AI.</p>}
          </div>
          <form onSubmit={submitAssistantPrompt} className="space-y-3 border-t border-outline-variant bg-surface-container-lowest p-3">
            <details className="group rounded-lg border border-outline-variant bg-surface-container-lowest">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Chọn hình dạng và phòng</summary>
              <div className="space-y-3 border-t border-outline-variant p-3">
                <label className="block space-y-1.5 text-xs text-on-surface-variant"><span>Hình dạng mặt bằng</span><select value={quickShape} onChange={event => { const shape = event.target.value; setQuickShape(shape); const outline = outlineTemplates[shape]; if (outline) { remember(); onChange({ ...plan, outline }); } }} className={fieldClass} disabled={disabled || aiGenerating}><option>Hình chữ nhật</option><option>Hình chữ L</option><option>Hình chữ U</option><option>Hình chữ T</option><option>Hình chữ H</option><option>Hình chữ thập</option>{quickShape === "Tùy chỉnh" && <option value="Tùy chỉnh">Tùy chỉnh</option>}</select></label>
                <label className="block space-y-1.5 text-xs text-on-surface-variant"><span>Thiết lập công năng tầng</span><select aria-label="Tầng thiết lập công năng" value={quickFloor} onChange={event => setQuickFloor(Number(event.target.value))} className={fieldClass} disabled={disabled || aiGenerating}>{Array.from({ length: floorsCount }, (_, index) => index + 1).map(value => <option key={value} value={value}>Tầng {value}</option>)}</select></label>
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1" aria-label={`Số lượng phòng tầng ${quickFloor}`}>{quickRoomTypes.map(name => {
                  const counts = quickRoomsByFloor[quickFloor] || (quickFloor === 1 ? defaultRoomCounts : { ...defaultRoomCounts, "Phòng ngủ": 2, "Phòng khách": 0, "Phòng bếp": 0, "Phòng ăn": 0, "Gara": 0, "Phòng sinh hoạt chung": 1, "Ban công": 1, "Phòng làm việc": 1 });
                  const count = counts[name] || 0;
                  return <li key={name} className="flex min-h-9 items-center justify-between gap-1 text-[11px] text-on-surface"><span className="truncate">{name}</span><span className="inline-flex shrink-0 items-center gap-1"><button type="button" aria-label={`Giảm số lượng ${name}`} className="flex size-7 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" disabled={disabled || aiGenerating || count <= 0} onClick={() => setQuickRoomsByFloor(current => ({ ...current, [quickFloor]: { ...counts, [name]: count - 1 } }))}><Minus className="size-3" aria-hidden="true" /></button><output className="w-4 text-center tabular-nums" aria-label={`${count} phòng ${name}`}>{count}</output><button type="button" aria-label={`Tăng số lượng ${name}`} className="flex size-7 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" disabled={disabled || aiGenerating || count >= 8} onClick={() => setQuickRoomsByFloor(current => ({ ...current, [quickFloor]: { ...counts, [name]: count + 1 } }))}><Plus className="size-3" aria-hidden="true" /></button></span></li>;
                })}</ul>
              </div>
            </details>
            <label htmlFor="architecture-plan-prompt" className="sr-only">Mô tả yêu cầu thiết kế mặt bằng</label>
            <textarea id="architecture-plan-prompt" value={assistantPrompt} onChange={event => setAssistantPrompt(event.target.value)} maxLength={1200} rows={4} placeholder="Ví dụ: thêm phòng làm việc cạnh phòng ngủ chính…" className={`${fieldClass} resize-y`} disabled={!canAskAi || aiGenerating} />
            <button type="submit" disabled={(!assistantPrompt.trim() && !quickShape) || !canAskAi || aiGenerating || disabled} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-on-surface px-3 text-sm font-semibold text-surface-container-lowest hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Send className="size-4" aria-hidden="true" />{aiGenerating ? "Đang tạo mặt bằng…" : "Tạo phương án"}</button>
          </form>
        </> : <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-label="Lịch sử chỉnh sửa mặt bằng">
          {!history.length ? <p className="px-2 py-4 text-sm text-on-surface-variant">Chưa có phiên bản trước.</p> : [...history].reverse().map((snapshot, index) => <button key={index} type="button" disabled={disabled} onClick={() => { remember(); onChange(structuredClone(snapshot)); }} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><span><span className="block text-sm font-semibold text-on-surface">Phiên bản {history.length - index}</span><span className="mt-1 block text-xs text-on-surface-variant">{snapshot.rooms.length} phòng · {snapshot.furniture?.length || 0} món nội thất</span></span><History className="size-4 text-on-surface-variant" aria-hidden="true" /></button>)}
        </div>}
      </aside>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 data-typography="section-title" className="text-balance text-sm font-semibold text-on-surface">Mặt bằng {view.toUpperCase()}</h3>
            <div className="flex items-center gap-1 rounded-lg border border-outline-variant p-1" role="group" aria-label="Chế độ xem mặt bằng">
              <button type="button" aria-pressed={view === "2d"} onClick={() => setView("2d")} className={cn("min-h-8 rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary", view === "2d" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container")}>2D</button>
              <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")} disabled={drawingRoom} className={cn("min-h-8 rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary", view === "3d" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container")}>3D</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={controlClass} aria-label="Hoàn tác" title="Ctrl/Cmd+Z" onClick={undo} disabled={disabled || !history.length}><Undo2 className="size-4" aria-hidden="true" />Hoàn tác</button>
            <button type="button" className={controlClass} aria-label="Làm lại" title="Ctrl/Cmd+Y hoặc Ctrl/Cmd+Shift+Z" onClick={redo} disabled={disabled || !redoHistory.length}><Redo2 className="size-4" aria-hidden="true" />Làm lại</button>
            <button type="button" className={controlClass} aria-label="Thu nhỏ bản vẽ" onClick={() => adjustZoom(-0.1)} disabled={zoom <= 0.2}>−</button>
            <span className="flex min-h-9 items-center px-1 text-xs tabular-nums text-on-surface-variant" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" className={controlClass} aria-label="Phóng to bản vẽ" onClick={() => adjustZoom(0.1)} disabled={zoom >= 4}>+</button>
            <button type="button" className={controlClass} aria-label="Đặt lại khung nhìn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>Đặt lại</button>
            <button type="button" className={cn(controlClass, showDimensions && "border-primary bg-primary/10 text-primary")} aria-pressed={showDimensions} onClick={() => setShowDimensions(value => !value)}><Ruler className="size-4" aria-hidden="true" />{showDimensions ? "Ẩn kích thước" : "Hiện kích thước"}</button>
            <button type="button" className={cn(controlClass, showLabels && "border-primary bg-primary/10 text-primary")} aria-pressed={showLabels} onClick={() => setShowLabels(value => !value)} aria-label={showLabels ? "Ẩn tên phòng" : "Hiện tên phòng"}>Tên phòng</button>
            {!disabled && <button type="button" className={cn(controlClass, drawingRoom && "border-primary bg-primary/10 text-primary")} aria-pressed={drawingRoom} onClick={() => { if (drawingRoom) cancelRoomDrawing(); else { setView("2d"); setDrawingRoom(true); setDrawingPoints([]); setDrawError(""); } }}><PenLine className="size-4" aria-hidden="true" />{drawingRoom ? "Hủy vẽ phòng" : "Vẽ phòng"}</button>}
            {drawingRoom && <button type="button" className={controlClass} onClick={() => finishRoomDrawing()} disabled={drawingPoints.length < 3}><Plus className="size-4" aria-hidden="true" />Hoàn tất phòng</button>}
            <button type="button" className={controlClass} onClick={exportFloorplanPng} disabled={view !== "2d" || drawingRoom} aria-describedby={view !== "2d" ? "architecture-export-png-help" : undefined} title={view !== "2d" ? "Chuyển sang chế độ 2D để xuất bản vẽ" : undefined}><Download className="size-4" aria-hidden="true" />Xuất PNG</button>
            {!disabled && <button type="button" className={controlClass} disabled={plan.rooms.length >= 40} onClick={() => { const room = makeRoomForOutline(floor, plan.outline, plan.rooms); remember(); onChange({ ...plan, rooms: [...plan.rooms, room] }); setSelectedId(room.id); setSelectedFurnitureId(undefined); }}><Plus className="size-4" aria-hidden="true" />Thêm phòng</button>}
          </div>
        </div>
        {exportError && <p role="alert" className="text-pretty text-xs text-error">{exportError}</p>}
        {view !== "2d" && <p id="architecture-export-png-help" className="text-pretty text-xs text-on-surface-variant">Chuyển sang chế độ 2D để xuất bản vẽ thành PNG.</p>}

        {drawingRoom && <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <p id="architecture-draw-room-help" className="text-pretty text-xs text-on-surface-variant">Chọn các điểm trên bản vẽ để vẽ đường bao. Đóng vùng bằng cách bấm gần điểm đầu, nhấn Enter hoặc Hoàn tất. Nhấn Escape để hủy, Backspace để bỏ điểm cuối.</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_5rem_5rem_auto] sm:items-end">
            <label className="block space-y-1 text-xs text-on-surface-variant"><span>Tên phòng</span><input className={fieldClass} value={drawRoomName} maxLength={80} onChange={event => setDrawRoomName(event.target.value)} /></label>
            <label className="block space-y-1 text-xs text-on-surface-variant"><span>Điểm X (%)</span><input ref={drawingXRef} className={fieldClass} type="number" min="1" max="99" step="1" value={drawPointX} onChange={event => setDrawPointX(Number(event.target.value))} /></label>
            <label className="block space-y-1 text-xs text-on-surface-variant"><span>Điểm Y (%)</span><input className={fieldClass} type="number" min="1" max="99" step="1" value={drawPointY} onChange={event => setDrawPointY(Number(event.target.value))} /></label>
            <button type="button" className={controlClass} onClick={() => { addDrawingPoint({ x: drawPointX, y: drawPointY }); drawingXRef.current?.focus(); }}>Thêm điểm</button>
          </div>
          <p className="text-xs tabular-nums text-on-surface-variant" aria-live="polite">{drawingPoints.length} điểm đã đặt</p>
          {drawError && <p className="text-pretty text-xs text-error" role="alert">{drawError}</p>}
        </div>}

        {view === "2d" ? <svg
          ref={svgRef} viewBox="0 0 100 100" role="group" tabIndex={drawingRoom ? 0 : undefined} aria-label={drawingRoom ? "Vẽ phòng: chọn các điểm trên bản vẽ" : "Bản vẽ mặt bằng 2D có thể chỉnh sửa"} aria-describedby={drawingRoom ? "architecture-draw-room-help" : undefined} className="aspect-square w-full touch-none rounded-lg border border-outline-variant bg-surface-container-lowest focus-visible:outline-2 focus-visible:outline-primary"
          onClick={event => { if (drawingRoom) addDrawingPoint(planPoint(event)); }} onDoubleClick={() => { if (drawingRoom) finishRoomDrawing(); }} onKeyDown={handleDrawingKeyDown}
          onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
        >
          <defs><pattern id="architecture-edit-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-outline-variant)" strokeWidth="0.18" /></pattern>{plan.outline && <clipPath id="architecture-edit-boundary-clip"><polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} /></clipPath>}</defs>
          <rect width="100" height="100" fill="url(#architecture-edit-grid)" pointerEvents="all" onPointerDown={beginPan} />
          <g transform={`translate(${50 + pan.x} ${50 + pan.y}) scale(${zoom}) translate(-50 -50)`} pointerEvents={drawingRoom ? "none" : "auto"}>
            {plan.outline && <polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} fill="var(--color-surface-container)" stroke="var(--color-primary)" strokeWidth="0.8" />}
            {drawingRoom && drawingPoints.length > 1 && <polyline points={drawingPoints.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--color-primary)" strokeWidth="0.8" strokeDasharray="1.6 1" aria-hidden="true" />}
            {drawingRoom && drawingPoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.2" fill="var(--color-primary)" stroke="var(--color-surface-container-lowest)" strokeWidth="0.4" pointerEvents="none" aria-hidden="true" />)}
            <g clipPath={plan.outline ? "url(#architecture-edit-boundary-clip)" : undefined}>
            {floorRooms.map(room => <g key={room.id} onPointerDown={event => beginGesture(event, "room-move", room.id)} onClick={() => { setSelectedId(room.id); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined); }} aria-label={`Phòng ${room.name}; chỉnh vị trí bằng kéo thả hoặc nhập tọa độ bên cạnh`} className={disabled ? "" : "cursor-move"}>
              <rect x={room.x} y={room.y} width={room.width} height={room.height} rx="0.6" fill={selected?.id === room.id ? "var(--color-primary-container)" : "var(--color-surface-container)"} stroke={selected?.id === room.id ? "var(--color-primary)" : "var(--color-outline)"} strokeWidth="0.7" />
              {showLabels && <text x={room.x + room.width / 2} y={room.y + room.height / 2 - 1.8} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="3.2" pointerEvents="none">{room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}</text>}
              {showLabels && <text x={room.x + room.width / 2} y={room.y + room.height / 2 + 2.2} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface-variant)" fontSize="2.4" pointerEvents="none">{room.areaM2} m²{showDimensions ? ` · ${Math.round(room.width)} × ${Math.round(room.height)}%` : ""}</text>}
              {!disabled && selected?.id === room.id && <rect x={room.x + room.width - 2} y={room.y + room.height - 2} width="3" height="3" rx="0.6" fill="var(--color-primary)" stroke="var(--color-surface-container-lowest)" strokeWidth="0.5" aria-hidden="true" className="cursor-nwse-resize" onPointerDown={event => beginGesture(event, "room-resize", room.id)} />}
            </g>)}
            {(plan.furniture || []).filter(item => floorRooms.some(room => room.id === item.roomId)).map(item => {
              const room = floorRooms.find(candidate => candidate.id === item.roomId)!;
              const x = room.x + item.x / 100 * room.width; const y = room.y + item.y / 100 * room.height;
              const width = item.width / 100 * room.width; const height = item.height / 100 * room.height;
              return <g key={item.id} onPointerDown={event => beginGesture(event, "furniture-move", item.id)} onClick={() => { setSelectedFurnitureId(item.id); setSelectedId(room.id); setSelectedOpeningId(undefined); }} className={disabled ? "" : "cursor-move"} aria-label={`Nội thất ${item.name}; chỉnh vị trí bằng kéo thả hoặc nhập tọa độ bên cạnh`}>
                <rect x={x} y={y} width={width} height={height} rx="0.5" fill={selectedFurnitureId === item.id ? "var(--color-primary-container)" : furnitureDisplayColor(item) || "var(--color-secondary-container)"} fillOpacity={selectedFurnitureId === item.id ? undefined : 0.72} stroke="var(--color-primary)" strokeWidth="0.35" transform={`rotate(${item.rotation} ${x + width / 2} ${y + height / 2})`} />
                <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="1.7" pointerEvents="none">{item.name.slice(0, 12)}</text>
              </g>;
            })}
            {(plan.openings || []).filter(item => floorRooms.some(room => room.id === item.roomId)).map(opening => {
              const room = floorRooms.find(candidate => candidate.id === opening.roomId)!; const segment = openingSegment(room, opening);
              return <g key={opening.id} onClick={() => { setSelectedOpeningId(opening.id); setSelectedId(room.id); setSelectedFurnitureId(undefined); }} aria-label={`${opening.type === "door" ? "Cửa" : "Cửa sổ"}, ${room.name}`} className="cursor-pointer">
                <line {...segment} stroke="var(--color-surface-container-lowest)" strokeWidth="2.4" />
                <line {...segment} stroke={opening.type === "door" ? "var(--color-primary)" : "var(--color-tertiary)"} strokeWidth={selectedOpeningId === opening.id ? "1.8" : "1.2"} />
              </g>;
            })}
            </g>
          </g>
          {!floorRooms.length && <text x="50" y="51" textAnchor="middle" fill="var(--color-on-surface-variant)" fontSize="4">Thêm phòng để bắt đầu</text>}
        </svg> : <ArchitecturePlan3DViewer plan={plan} floor={floor} fallback={<ArchitecturePlanIsometric plan={plan} floor={floor} />} canGenerateAi={canGenerateAi} rendering={rendering} onGenerateRender={onGenerate3DRender} />}
        {view === "2d" && <p className="text-pretty text-xs text-on-surface-variant">Kéo phòng để di chuyển, kéo vùng trống để dịch bản vẽ, kéo nút ở góc dưới phải để đổi kích thước. Kéo nội thất để bố trí lại; có thể nhập tọa độ ở bảng bên cạnh. Ctrl/Cmd+Z để hoàn tác, Ctrl/Cmd+Y để làm lại.</p>}
        {floorRooms.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Chọn phòng để chỉnh sửa">{floorRooms.map(room => <li key={room.id}>
          <button type="button" disabled={disabled} aria-pressed={selected?.id === room.id} onClick={() => { setSelectedId(room.id); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined); }} className={cn("min-h-9 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60", selected?.id === room.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface hover:bg-surface-container")}>
            {room.name} <span className="ml-1 text-xs tabular-nums text-on-surface-variant">{room.areaM2} m²</span>
          </button>
        </li>)}</ul>}
      </div>

      <div className="min-w-0 space-y-4">
        {selected && <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-outline-variant p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-semibold text-on-surface">Thông số phòng</legend>
          <label className="block space-y-1 text-sm text-on-surface-variant"><span>Tên phòng</span><input className={fieldClass} required value={selected.name} maxLength={80} onFocus={() => remember()} onChange={event => updateRoom(selected.id, { name: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height", "areaM2"] as const).map(key => <label key={key} className="block space-y-1 text-sm text-on-surface-variant">
            <span>{({ x: "Vị trí X (%)", y: "Vị trí Y (%)", width: "Rộng (%)", height: "Dài (%)", areaM2: "Diện tích (m²)" })[key]}</span>
            <input className={fieldClass} type="number" required min={key === "areaM2" ? 0.1 : 0} max={key === "areaM2" ? 20000 : key === "x" ? 100 - selected.width : key === "y" ? 100 - selected.height : key === "width" ? 100 - selected.x : key === "height" ? 100 - selected.y : 100} step={key === "areaM2" ? 0.5 : 1} value={selected[key]} onFocus={() => remember()} onChange={event => updateRoom(selected.id, { [key]: Number(event.target.value) })} />
          </label>)}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={controlClass} disabled={plan.rooms.length >= 40} onClick={() => { const proposed = { ...selected, id: crypto.randomUUID(), name: `${selected.name} (bản sao)`, x: Math.min(100 - selected.width, selected.x + 3), y: Math.min(100 - selected.height, selected.y + 3) }; const others = plan.rooms.filter(room => room.id !== selected.id); const copy = (!plan.outline || roomFitsOutline(proposed, plan.outline)) && !others.some(room => roomsOverlap(proposed, room)) ? proposed : makeRoomForOutline(floor, plan.outline, plan.rooms); remember(); onChange({ ...plan, rooms: [...plan.rooms, copy] }); setSelectedId(copy.id); }}><Copy className="size-4" aria-hidden="true" />Nhân bản phòng</button>
            <button type="button" onClick={() => { remember(); onChange({ ...plan, rooms: plan.rooms.filter(room => room.id !== selected.id), furniture: (plan.furniture || []).filter(item => item.roomId !== selected.id), openings: (plan.openings || []).filter(item => item.roomId !== selected.id) }); setSelectedId(undefined); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm text-error hover:bg-error-container/30 focus-visible:outline-2 focus-visible:outline-primary"><Trash2 className="size-4" aria-hidden="true" />Xóa phòng</button>
          </div>
        </fieldset>}

        {selected && <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-outline-variant p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-semibold text-on-surface">Phong cách và hoàn thiện</legend>
          <label className="block space-y-1 text-sm text-on-surface-variant"><span>Phong cách phòng</span><select className={fieldClass} value={selected.style || "Hiện đại"} onFocus={() => remember()} onChange={event => updateRoom(selected.id, { style: event.target.value })}>{["Hiện đại", "Tối giản", "Scandinavian", "Japandi", "Công nghiệp", "Tân cổ điển"].map(style => <option key={style}>{style}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(finishChoices) as Array<keyof typeof finishChoices>).map(key => <label key={key} className="block space-y-1 text-sm text-on-surface-variant">
            <span>{({ flooring: "Sàn", walls: "Tường", ceiling: "Trần", doors: "Cửa đi", windows: "Cửa sổ" })[key]}</span>
            <select className={fieldClass} value={selected.finishes?.[key] || finishChoices[key][0]} onFocus={() => remember()} onChange={event => updateRoom(selected.id, { finishes: { ...selected.finishes, [key]: event.target.value } })}>{finishChoices[key].map(finish => <option key={finish}>{finish}</option>)}</select>
          </label>)}</div>
          <button type="button" className={controlClass} onClick={() => {
            remember();
            onChange({ ...plan, rooms: plan.rooms.map(room => room.floor === floor ? { ...room, style: selected.style || "Hiện đại", finishes: { ...selected.finishes } } : room) });
          }}>Áp dụng hoàn thiện cho tầng này</button>
        </fieldset>}

        {selected && <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-outline-variant p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-semibold text-on-surface">Nội thất</legend>
          <div className="space-y-2">
            <label htmlFor={`architecture-furniture-search-${floor}`} className="sr-only">Tìm trong thư viện nội thất</label>
            <input id={`architecture-furniture-search-${floor}`} type="search" className={fieldClass} value={furnitureSearch} onChange={event => { const query = event.target.value; setFurnitureSearch(query); const matches = furnitureCatalog.filter(item => `${item.name} ${item.category}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))); if (matches.length && !matches.some(item => item.name === newFurnitureType)) setNewFurnitureType(matches[0].name); }} placeholder="Tìm sofa, giường, bếp…" />
            <div className="flex flex-wrap gap-2"><select className={`${fieldClass} min-w-36 flex-1`} aria-label="Chọn mẫu nội thất" value={newFurnitureType} onChange={event => setNewFurnitureType(event.target.value)}>
              {Array.from(new Set(filteredFurnitureCatalog.map(item => item.category))).map(category => <optgroup key={category} label={category}>{filteredFurnitureCatalog.filter(item => item.category === category).map(item => <option key={`${item.category}-${item.name}`} value={item.name}>{item.name}</option>)}</optgroup>)}
              {!filteredFurnitureCatalog.length && <option value="" disabled>Không tìm thấy nội thất</option>}
            </select><button type="button" className={controlClass} disabled={!filteredFurnitureCatalog.some(item => item.name === newFurnitureType) || (plan.furniture || []).length >= 400 || (plan.furniture || []).filter(item => item.roomId === selected.id).length >= 40} onClick={() => { const item = furnitureCatalog.find(candidate => candidate.name === newFurnitureType); if (item) addFurniture(selected, item.type, item.name); }}><Plus className="size-4" aria-hidden="true" />Thêm nội thất</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" className={controlClass} disabled={(plan.furniture || []).length >= 400 || (plan.furniture || []).filter(item => item.roomId === selected.id).length >= 40} onClick={() => {
              const currentItems = plan.furniture || [];
              const existing = new Set(currentItems.filter(item => item.roomId === selected.id).map(item => item.name));
              const suggestions = suggestedFurniture(selected.name).filter(item => !existing.has(item.name)).slice(0, Math.min(6, 40 - currentItems.filter(item => item.roomId === selected.id).length));
              if (!suggestions.length) return;
              remember();
              const added = suggestions.map((item, index): ArchitectureFurniture => ({ id: crypto.randomUUID(), roomId: selected.id, type: item.type, name: item.name, x: 8 + index % 3 * 30, y: 12 + Math.floor(index / 3) * 26, width: 24, height: 20, rotation: 0 }));
              onChange({ ...plan, furniture: [...currentItems, ...added] }); setSelectedFurnitureId(added[0].id);
            }}><Plus className="size-4" aria-hidden="true" />Bố trí gợi ý</button></div>
          {(plan.furniture || []).filter(item => item.roomId === selected.id).length > 0 ? <ul className="space-y-1" aria-label="Nội thất trong phòng">{(plan.furniture || []).filter(item => item.roomId === selected.id).map(item => <li key={item.id} className="flex items-center gap-1">
            <button type="button" aria-pressed={item.id === selectedFurnitureId} onClick={() => { setSelectedFurnitureId(item.id); setSelectedOpeningId(undefined); }} className={cn("min-h-9 min-w-0 flex-1 truncate rounded-lg border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary", item.id === selectedFurnitureId ? "border-primary bg-primary/10 text-primary" : "border-outline-variant hover:bg-surface-container")}>{item.name} <span className="text-xs text-on-surface-variant">· {item.type}</span></button>
            <button type="button" className={controlClass} aria-label={`Xoay ${item.name}`} onClick={() => { remember(); updateFurniture(item.id, { rotation: ((item.rotation + 90) % 360) as ArchitectureFurniture["rotation"] }); }}><RotateCw className="size-4" aria-hidden="true" /></button>
            <button type="button" className={controlClass} aria-label={`Xóa ${item.name}`} onClick={() => { remember(); onChange({ ...plan, furniture: (plan.furniture || []).filter(candidate => candidate.id !== item.id) }); setSelectedFurnitureId(undefined); }}><Trash2 className="size-4" aria-hidden="true" /></button>
          </li>)}</ul> : <p className="text-pretty text-xs text-on-surface-variant">Chưa có nội thất. Chọn bố trí gợi ý hoặc thêm từng món.</p>}
          {selectedFurniture && <div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-3">
            {selectedFurnitureVariants.length > 0 && <label className="block space-y-1 text-sm text-on-surface-variant"><span>Kiểu dáng</span><select className={fieldClass} value={selectedFurniture.style || ""} onFocus={() => remember()} onChange={event => updateFurniture(selectedFurniture.id, { style: event.target.value || undefined })}><option value="">Mặc định</option>{selectedFurnitureVariants.map(variant => <option key={variant.value} value={variant.value}>{variant.label}</option>)}</select></label>}
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Vật liệu</span><select className={fieldClass} value={selectedFurniture.material || ""} onFocus={() => remember()} onChange={event => { const material = furnitureMaterials.find(item => item.value === event.target.value); updateFurniture(selectedFurniture.id, { material: material?.value, color: material?.color }); }}><option value="">Theo mẫu 3D</option>{furnitureMaterials.map(material => <option key={material.value} value={material.value}>{material.name}</option>)}</select></label>
            {selectedFurniture.material && <label className="col-span-2 flex items-center gap-3 text-sm text-on-surface-variant"><span className="flex-1">Màu vật liệu</span><input aria-label="Màu vật liệu nội thất" className="size-10 cursor-pointer rounded border border-outline-variant bg-surface p-1" type="color" value={selectedFurniture.color || furnitureMaterials.find(item => item.value === selectedFurniture.material)?.color || "#96734d"} onFocus={() => remember()} onChange={event => updateFurniture(selectedFurniture.id, { color: event.target.value })} /><span className="font-mono text-xs uppercase">{selectedFurniture.color || furnitureMaterials.find(item => item.value === selectedFurniture.material)?.color}</span></label>}
            <label className="col-span-2 block space-y-1 text-sm text-on-surface-variant"><span>Tên món đồ</span><input className={fieldClass} maxLength={80} value={selectedFurniture.name} onFocus={() => remember()} onChange={event => updateFurniture(selectedFurniture.id, { name: event.target.value })} /></label>
            {(["x", "y", "width", "height"] as const).map(key => <label key={key} className="block space-y-1 text-sm text-on-surface-variant"><span>{({ x: "Vị trí X (%)", y: "Vị trí Y (%)", width: "Rộng (%)", height: "Dài (%)" })[key]}</span><input className={fieldClass} type="number" min="0" max={key === "x" ? 100 - selectedFurniture.width : key === "y" ? 100 - selectedFurniture.height : key === "width" ? 100 - selectedFurniture.x : 100 - selectedFurniture.y} step="1" value={selectedFurniture[key]} onFocus={() => remember()} onChange={event => updateFurniture(selectedFurniture.id, { [key]: Number(event.target.value) })} /></label>)}
          </div>}
        </fieldset>}

        {selected && <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-outline-variant p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-semibold text-on-surface">Cửa và cửa sổ</legend>
          <div className="flex flex-wrap gap-2"><button type="button" className={controlClass} disabled={(plan.openings || []).length >= 200} onClick={() => addOpening(selected, "door")}><DoorOpen className="size-4" aria-hidden="true" />Thêm cửa</button><button type="button" className={controlClass} disabled={(plan.openings || []).length >= 200} onClick={() => addOpening(selected, "window")}><AppWindow className="size-4" aria-hidden="true" />Thêm cửa sổ</button></div>
          {(plan.openings || []).filter(item => item.roomId === selected.id).map(item => <div key={item.id} className="flex items-center gap-1">
            <button type="button" aria-pressed={item.id === selectedOpeningId} onClick={() => { setSelectedOpeningId(item.id); setSelectedFurnitureId(undefined); }} className={cn("min-h-9 flex-1 rounded-lg border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary", item.id === selectedOpeningId ? "border-primary bg-primary/10 text-primary" : "border-outline-variant hover:bg-surface-container")}>{item.type === "door" ? "Cửa" : "Cửa sổ"} · {openingWalls.find(wall => wall.value === item.wall)?.label}</button>
            <button type="button" className={controlClass} aria-label={`Xóa ${item.type === "door" ? "cửa" : "cửa sổ"}`} onClick={() => { remember(); onChange({ ...plan, openings: (plan.openings || []).filter(candidate => candidate.id !== item.id) }); setSelectedOpeningId(undefined); }}><Trash2 className="size-4" aria-hidden="true" /></button>
          </div>)}
          {selectedOpening && <div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-3">
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Vị trí tường</span><select className={fieldClass} value={selectedOpening.wall} onFocus={() => remember()} onChange={event => updateOpening(selectedOpening.id, { wall: event.target.value as ArchitectureOpening["wall"] })}>{openingWalls.map(wall => <option key={wall.value} value={wall.value}>{wall.label}</option>)}</select></label>
            <label className="block space-y-1 text-sm text-on-surface-variant"><span>Vị trí dọc tường (%)</span><input className={fieldClass} type="number" min="0" max="100" value={selectedOpening.offset} onFocus={() => remember()} onChange={event => updateOpening(selectedOpening.id, { offset: Number(event.target.value) })} /></label>
            <label className="col-span-2 block space-y-1 text-sm text-on-surface-variant"><span>Độ rộng (%)</span><input className={fieldClass} type="number" min="1" max="100" value={selectedOpening.width} onFocus={() => remember()} onChange={event => updateOpening(selectedOpening.id, { width: Number(event.target.value) })} /></label>
          </div>}
        </fieldset>}

        <label className="block space-y-1 text-sm text-on-surface-variant"><span>Ghi chú mặt bằng</span><textarea className={`${fieldClass} min-h-24 resize-y`} maxLength={1200} value={plan.notes} disabled={disabled} onFocus={() => remember()} onChange={event => onChange({ ...plan, notes: event.target.value })} /></label>
      </div>
    </div>
  );
}
