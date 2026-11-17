import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AppWindow, Copy, DoorOpen, History, MessageCircle, Minus, Plus, Redo2, RotateCw, Send, Trash2, Undo2 } from "lucide-react";
import { cn } from "../student-management/lib/utils";
import type { ArchitectureFurniture, ArchitectureOpening, ArchitecturePlan, ArchitectureRoom } from "../../shared/architecture-assistant";
import ArchitecturePlan3DViewer from "./ArchitecturePlan3DViewer";

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const controlClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const furnitureTypes = ["Giường", "Sofa", "Bàn", "Tủ", "Bếp", "Thiết bị vệ sinh", "Bàn làm việc", "Đồ nội thất khác"];
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
  return Object.entries(outlineTemplates).find(([, points]) => signature(points) === signature(outline))?.[0] || "Hình chữ nhật";
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

function suggestedFurniture(name: string) {
  const value = name.toLocaleLowerCase("vi");
  if (/ngủ|bedroom/.test(value)) return [{ type: "Giường", name: "Giường đôi" }, { type: "Tủ", name: "Tủ quần áo" }];
  if (/khách|sinh hoạt|living/.test(value)) return [{ type: "Sofa", name: "Sofa" }, { type: "Bàn", name: "Bàn trà" }];
  if (/bếp|ăn|kitchen|dining/.test(value)) return [{ type: "Bếp", name: "Bàn bếp" }, { type: "Bàn", name: "Bàn ăn" }];
  if (/tắm|vệ sinh|wc|bath/.test(value)) return [{ type: "Thiết bị vệ sinh", name: "Bồn rửa" }];
  return [{ type: "Bàn làm việc", name: "Bàn" }, { type: "Tủ", name: "Tủ lưu trữ" }];
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
  onGenerate3DRender?: (image: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string>();
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [zoom, setZoom] = useState(1);
  const [newFurnitureType, setNewFurnitureType] = useState(furnitureTypes[0]);
  const [history, setHistory] = useState<ArchitecturePlan[]>([]);
  const [redoHistory, setRedoHistory] = useState<ArchitecturePlan[]>([]);
  const [assistantTab, setAssistantTab] = useState<"chat" | "history">("chat");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [quickShape, setQuickShape] = useState(() => shapeFromOutline(plan.outline));
  const [quickFloor, setQuickFloor] = useState(floor);
  const [quickRoomsByFloor, setQuickRoomsByFloor] = useState<Record<number, Record<string, number>>>({});
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "assistant" | "user"; text: string; pending?: boolean }>>([
    { role: "assistant", text: "Mô tả công năng, diện tích từng khu vực hoặc thay đổi bạn muốn. AI sẽ đề xuất phương án mặt bằng để bạn tiếp tục chỉnh sửa." },
  ]);
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const floorRooms = plan.rooms.filter(room => room.floor === floor);
  const selected = floorRooms.find(room => room.id === selectedId) || floorRooms[0];
  const selectedFurniture = (plan.furniture || []).find(item => item.id === selectedFurnitureId && item.roomId === selected?.id);
  const selectedOpening = (plan.openings || []).find(item => item.id === selectedOpeningId && item.roomId === selected?.id);
  const remember = (previous = plan) => { setHistory(items => [...items.slice(-29), structuredClone(previous)]); setRedoHistory([]); };
  const currentOutlineSignature = plan.outline?.map(point => `${point.x},${point.y}`).join(";") || "";

  useEffect(() => setQuickFloor(floor), [floor]);
  useEffect(() => setQuickShape(shapeFromOutline(plan.outline)), [currentOutlineSignature]);

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
    const outline = outlineTemplates[quickShape] || outlineTemplates["Hình chữ nhật"];
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
    return { x: (rawX - 50) / zoom + 50, y: (rawY - 50) / zoom + 50 };
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
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setHistory(items => [...items.slice(-29), gesture.original]); setRedoHistory([]); gestureRef.current = null;
  };
  const adjustZoom = (amount: number) => setZoom(current => Math.max(0.7, Math.min(2, Math.round((current + amount) * 10) / 10)));
  const openingSegment = (room: ArchitectureRoom, opening: ArchitectureOpening) => {
    const half = Math.min(opening.width, 100) / 2; const start = Math.max(0, Math.min(100, opening.offset - half)); const end = Math.max(0, Math.min(100, opening.offset + half));
    if (opening.wall === "north" || opening.wall === "south") { const y = room.y + (opening.wall === "south" ? room.height : 0); return { x1: room.x + start / 100 * room.width, y1: y, x2: room.x + end / 100 * room.width, y2: y }; }
    const x = room.x + (opening.wall === "east" ? room.width : 0); return { x1: x, y1: room.y + start / 100 * room.height, x2: x, y2: room.y + end / 100 * room.height };
  };

  return (
    <div className="grid overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm xl:grid-cols-[19rem_minmax(0,1fr)_minmax(18rem,0.8fr)]">
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
                <label className="block space-y-1.5 text-xs text-on-surface-variant"><span>Hình dạng mặt bằng</span><select value={quickShape} onChange={event => { const shape = event.target.value; setQuickShape(shape); const outline = outlineTemplates[shape]; if (outline) { remember(); onChange({ ...plan, outline }); } }} className={fieldClass} disabled={disabled || aiGenerating}><option>Hình chữ nhật</option><option>Hình chữ L</option><option>Hình chữ U</option><option>Hình chữ T</option><option>Hình chữ H</option><option>Hình chữ thập</option></select></label>
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
              <button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")} className={cn("min-h-8 rounded-md px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary", view === "3d" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container")}>3D</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={controlClass} aria-label="Hoàn tác" onClick={undo} disabled={disabled || !history.length}><Undo2 className="size-4" aria-hidden="true" />Hoàn tác</button>
            <button type="button" className={controlClass} aria-label="Làm lại" onClick={redo} disabled={disabled || !redoHistory.length}><Redo2 className="size-4" aria-hidden="true" />Làm lại</button>
            <button type="button" className={controlClass} aria-label="Thu nhỏ bản vẽ" onClick={() => adjustZoom(-0.1)} disabled={zoom <= 0.7}>−</button>
            <span className="flex min-h-9 items-center px-1 text-xs tabular-nums text-on-surface-variant" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" className={controlClass} aria-label="Phóng to bản vẽ" onClick={() => adjustZoom(0.1)} disabled={zoom >= 2}>+</button>
            {!disabled && <button type="button" className={controlClass} disabled={plan.rooms.length >= 40} onClick={() => { const room = makeRoomForOutline(floor, plan.outline, plan.rooms); remember(); onChange({ ...plan, rooms: [...plan.rooms, room] }); setSelectedId(room.id); setSelectedFurnitureId(undefined); }}><Plus className="size-4" aria-hidden="true" />Thêm phòng</button>}
          </div>
        </div>

        {view === "2d" ? <svg
          ref={svgRef} viewBox="0 0 100 100" role="group" aria-label="Bản vẽ mặt bằng 2D có thể chỉnh sửa" className="aspect-square w-full touch-none rounded-lg border border-outline-variant bg-surface-container-lowest"
          onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
        >
          <defs><pattern id="architecture-edit-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-outline-variant)" strokeWidth="0.18" /></pattern>{plan.outline && <clipPath id="architecture-edit-boundary-clip"><polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} /></clipPath>}</defs>
          <rect width="100" height="100" fill="url(#architecture-edit-grid)" />
          <g transform={`translate(50 50) scale(${zoom}) translate(-50 -50)`}>
            {plan.outline && <polygon points={plan.outline.map(point => `${point.x},${point.y}`).join(" ")} fill="var(--color-surface-container)" stroke="var(--color-primary)" strokeWidth="0.8" />}
            <g clipPath={plan.outline ? "url(#architecture-edit-boundary-clip)" : undefined}>
            {floorRooms.map(room => <g key={room.id} onPointerDown={event => beginGesture(event, "room-move", room.id)} onClick={() => { setSelectedId(room.id); setSelectedFurnitureId(undefined); setSelectedOpeningId(undefined); }} aria-label={`Phòng ${room.name}; chỉnh vị trí bằng kéo thả hoặc nhập tọa độ bên cạnh`} className={disabled ? "" : "cursor-move"}>
              <rect x={room.x} y={room.y} width={room.width} height={room.height} rx="0.6" fill={selected?.id === room.id ? "var(--color-primary-container)" : "var(--color-surface-container)"} stroke={selected?.id === room.id ? "var(--color-primary)" : "var(--color-outline)"} strokeWidth="0.7" />
              <text x={room.x + room.width / 2} y={room.y + room.height / 2 - 1.8} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="3.2" pointerEvents="none">{room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}</text>
              <text x={room.x + room.width / 2} y={room.y + room.height / 2 + 2.2} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface-variant)" fontSize="2.4" pointerEvents="none">{room.areaM2} m² · {Math.round(room.width)} × {Math.round(room.height)}%</text>
              {!disabled && selected?.id === room.id && <rect x={room.x + room.width - 2} y={room.y + room.height - 2} width="3" height="3" rx="0.6" fill="var(--color-primary)" stroke="var(--color-surface-container-lowest)" strokeWidth="0.5" aria-hidden="true" className="cursor-nwse-resize" onPointerDown={event => beginGesture(event, "room-resize", room.id)} />}
            </g>)}
            {(plan.furniture || []).filter(item => floorRooms.some(room => room.id === item.roomId)).map(item => {
              const room = floorRooms.find(candidate => candidate.id === item.roomId)!;
              const x = room.x + item.x / 100 * room.width; const y = room.y + item.y / 100 * room.height;
              const width = item.width / 100 * room.width; const height = item.height / 100 * room.height;
              return <g key={item.id} onPointerDown={event => beginGesture(event, "furniture-move", item.id)} onClick={() => { setSelectedFurnitureId(item.id); setSelectedId(room.id); setSelectedOpeningId(undefined); }} className={disabled ? "" : "cursor-move"} aria-label={`Nội thất ${item.name}; chỉnh vị trí bằng kéo thả hoặc nhập tọa độ bên cạnh`}>
                <rect x={x} y={y} width={width} height={height} rx="0.5" fill={selectedFurnitureId === item.id ? "var(--color-primary-container)" : "var(--color-secondary-container)"} stroke="var(--color-primary)" strokeWidth="0.35" transform={`rotate(${item.rotation} ${x + width / 2} ${y + height / 2})`} />
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
        {view === "2d" && <p className="text-pretty text-xs text-on-surface-variant">Kéo phòng để di chuyển, kéo nút ở góc dưới phải để đổi kích thước. Kéo nội thất để bố trí lại; có thể nhập tọa độ ở bảng bên cạnh.</p>}
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
          <div className="flex flex-wrap gap-2"><select className={`${fieldClass} min-w-36 flex-1`} aria-label="Loại nội thất mới" value={newFurnitureType} onChange={event => setNewFurnitureType(event.target.value)}>{furnitureTypes.map(type => <option key={type}>{type}</option>)}</select><button type="button" className={controlClass} disabled={(plan.furniture || []).length >= 400 || (plan.furniture || []).filter(item => item.roomId === selected.id).length >= 40} onClick={() => addFurniture(selected, newFurnitureType)}><Plus className="size-4" aria-hidden="true" />Thêm nội thất</button>
            <button type="button" className={controlClass} disabled={(plan.furniture || []).length >= 400 || (plan.furniture || []).filter(item => item.roomId === selected.id).length >= 40} onClick={() => {
              const currentItems = plan.furniture || [];
              const existing = new Set(currentItems.filter(item => item.roomId === selected.id).map(item => item.name));
              const suggestions = suggestedFurniture(selected.name).filter(item => !existing.has(item.name)).slice(0, Math.max(0, 40 - currentItems.filter(item => item.roomId === selected.id).length));
              if (!suggestions.length) return;
              remember();
              const added = suggestions.map((item, index): ArchitectureFurniture => ({ id: crypto.randomUUID(), roomId: selected.id, type: item.type, name: item.name, x: 12 + index * 34, y: 20 + index * 30, width: 25, height: 20, rotation: 0 }));
              onChange({ ...plan, furniture: [...currentItems, ...added] }); setSelectedFurnitureId(added[0].id);
            }}><Plus className="size-4" aria-hidden="true" />Bố trí gợi ý</button>
          </div>
          {(plan.furniture || []).filter(item => item.roomId === selected.id).length > 0 ? <ul className="space-y-1" aria-label="Nội thất trong phòng">{(plan.furniture || []).filter(item => item.roomId === selected.id).map(item => <li key={item.id} className="flex items-center gap-1">
            <button type="button" aria-pressed={item.id === selectedFurnitureId} onClick={() => { setSelectedFurnitureId(item.id); setSelectedOpeningId(undefined); }} className={cn("min-h-9 min-w-0 flex-1 truncate rounded-lg border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary", item.id === selectedFurnitureId ? "border-primary bg-primary/10 text-primary" : "border-outline-variant hover:bg-surface-container")}>{item.name} <span className="text-xs text-on-surface-variant">· {item.type}</span></button>
            <button type="button" className={controlClass} aria-label={`Xoay ${item.name}`} onClick={() => { remember(); updateFurniture(item.id, { rotation: ((item.rotation + 90) % 360) as ArchitectureFurniture["rotation"] }); }}><RotateCw className="size-4" aria-hidden="true" /></button>
            <button type="button" className={controlClass} aria-label={`Xóa ${item.name}`} onClick={() => { remember(); onChange({ ...plan, furniture: (plan.furniture || []).filter(candidate => candidate.id !== item.id) }); setSelectedFurnitureId(undefined); }}><Trash2 className="size-4" aria-hidden="true" /></button>
          </li>)}</ul> : <p className="text-pretty text-xs text-on-surface-variant">Chưa có nội thất. Chọn bố trí gợi ý hoặc thêm từng món.</p>}
          {selectedFurniture && <div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-3">
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
