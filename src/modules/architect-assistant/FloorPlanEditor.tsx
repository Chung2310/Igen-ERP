import { useRef, useState, type PointerEvent } from "react";
import { AppWindow, Copy, DoorOpen, Plus, Redo2, RotateCw, Trash2, Undo2 } from "lucide-react";
import { cn } from "../student-management/lib/utils";
import type { ArchitectureFurniture, ArchitectureOpening, ArchitecturePlan, ArchitectureRoom } from "../../shared/architecture-assistant";
import ArchitecturePlan3DViewer from "./ArchitecturePlan3DViewer";

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
const controlClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const furnitureTypes = ["Giường", "Sofa", "Bàn", "Tủ", "Bếp", "Thiết bị vệ sinh", "Bàn làm việc", "Đồ nội thất khác"];
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

export function ArchitecturePlanSvg({ plan, floor = 1 }: { plan: ArchitecturePlan; floor?: number }) {
  const rooms = plan.rooms.filter(room => room.floor === floor);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Sơ đồ mặt bằng 2D" className="aspect-square w-full rounded-lg border border-outline-variant bg-surface-container-lowest">
      <defs><pattern id="architecture-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-outline-variant)" strokeWidth="0.18" /></pattern></defs>
      <rect width="100" height="100" fill="url(#architecture-grid)" />
      {rooms.map(room => <g key={room.id}>
        <rect x={room.x} y={room.y} width={room.width} height={room.height} rx="0.6" fill="var(--color-surface-container)" stroke="var(--color-outline)" strokeWidth="0.7" />
        <text x={room.x + room.width / 2} y={room.y + room.height / 2 - 1} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface)" fontSize="3.4" pointerEvents="none">{room.name.length > 16 ? `${room.name.slice(0, 15)}…` : room.name}</text>
        <text x={room.x + room.width / 2} y={room.y + room.height / 2 + 3} textAnchor="middle" dominantBaseline="middle" fill="var(--color-on-surface-variant)" fontSize="2.6" pointerEvents="none">{room.areaM2} m²</text>
      </g>)}
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

export default function FloorPlanEditor({ plan, onChange, disabled = false, floor = 1, canGenerateAi = false, rendering = false, onGenerate3DRender }: {
  plan: ArchitecturePlan;
  onChange: (plan: ArchitecturePlan) => void;
  disabled?: boolean;
  floor?: number;
  canGenerateAi?: boolean;
  rendering?: boolean;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const floorRooms = plan.rooms.filter(room => room.floor === floor);
  const selected = floorRooms.find(room => room.id === selectedId) || floorRooms[0];
  const selectedFurniture = (plan.furniture || []).find(item => item.id === selectedFurnitureId && item.roomId === selected?.id);
  const selectedOpening = (plan.openings || []).find(item => item.id === selectedOpeningId && item.roomId === selected?.id);
  const remember = (previous = plan) => { setHistory(items => [...items.slice(-29), structuredClone(previous)]); setRedoHistory([]); };

  const updateRoom = (id: string, changes: Partial<ArchitectureRoom>) => onChange({ ...plan, rooms: plan.rooms.map(room => room.id === id ? { ...room, ...changes } : room) });
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
      onChange({ ...gesture.original, rooms: gesture.original.rooms.map(room => room.id === base.id ? { ...room, x, y, width, height, areaM2 } : room) });
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
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
            {!disabled && <button type="button" className={controlClass} disabled={plan.rooms.length >= 40} onClick={() => { const room = makeRoom(floor); remember(); onChange({ ...plan, rooms: [...plan.rooms, room] }); setSelectedId(room.id); setSelectedFurnitureId(undefined); }}><Plus className="size-4" aria-hidden="true" />Thêm phòng</button>}
          </div>
        </div>

        {view === "2d" ? <svg
          ref={svgRef} viewBox="0 0 100 100" role="group" aria-label="Bản vẽ mặt bằng 2D có thể chỉnh sửa" className="aspect-square w-full touch-none rounded-lg border border-outline-variant bg-surface-container-lowest"
          onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
        >
          <defs><pattern id="architecture-edit-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-outline-variant)" strokeWidth="0.18" /></pattern></defs>
          <rect width="100" height="100" fill="url(#architecture-edit-grid)" />
          <g transform={`translate(50 50) scale(${zoom}) translate(-50 -50)`}>
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
            <button type="button" className={controlClass} disabled={plan.rooms.length >= 40} onClick={() => { const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} (bản sao)`, x: Math.min(100 - selected.width, selected.x + 3), y: Math.min(100 - selected.height, selected.y + 3) }; remember(); onChange({ ...plan, rooms: [...plan.rooms, copy] }); setSelectedId(copy.id); }}><Copy className="size-4" aria-hidden="true" />Nhân bản phòng</button>
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
