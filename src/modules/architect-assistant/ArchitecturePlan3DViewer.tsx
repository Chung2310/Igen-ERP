import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Download, Rotate3D, Sparkles } from "lucide-react";
import type { ArchitectureOpening, ArchitecturePlan, ArchitectureRoom } from "../../shared/architecture-assistant";

type CameraPreset = "isometric" | "front" | "top";
type ViewerState = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls };
const WORLD_SCALE = 0.16;
const WALL_HEIGHT = 2.7;
const WALL_THICKNESS = 0.12;

function tokenColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return value || fallback;
}

function floorColor(finish?: string) {
  if (finish === "Gỗ tối") return 0x765338;
  if (finish === "Gạch đá") return 0xb8b5ad;
  if (finish === "Terrazzo") return 0xbac1c1;
  if (finish === "Bê tông mài") return 0x888b8d;
  return 0xc6a77a;
}

function wallColor(finish?: string) {
  if (finish === "Màu kem") return 0xe9dec8;
  if (finish === "Xám nhạt") return 0xc9ced2;
  if (finish === "Xanh nhạt") return 0xc1d8df;
  if (finish === "Xanh olive") return 0xb5b99c;
  return 0xf1eee7;
}

function buildRoomScene(plan: ArchitecturePlan, floor: number, scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = "architecture-plan";
  const rooms = plan.rooms.filter(room => room.floor === floor);
  const roomById = new Map(rooms.map(room => [room.id, room]));
  const wallItems = (plan.openings || []).filter(item => roomById.has(item.roomId));

  const addBox = (parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material, rotationY = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.rotation.y = rotationY; mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };

  for (const room of rooms) {
    const x1 = (room.x - 50) * WORLD_SCALE; const z1 = (room.y - 50) * WORLD_SCALE;
    const width = room.width * WORLD_SCALE; const depth = room.height * WORLD_SCALE;
    const floorMaterial = new THREE.MeshStandardMaterial({ color: floorColor(room.finishes?.flooring), roughness: 0.78 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor(room.finishes?.walls), roughness: 0.92, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), floorMaterial);
    floorMesh.position.set(x1 + width / 2, 0, z1 + depth / 2); floorMesh.receiveShadow = true; root.add(floorMesh);

    const addWall = (side: ArchitectureOpening["wall"], start: number, end: number) => {
      if (end - start < 0.005) return;
      if (side === "north" || side === "south") {
        const segmentWidth = width * (end - start);
        const x = x1 + width * (start + end) / 2;
        const z = z1 + (side === "south" ? depth : 0);
        addBox(root, [segmentWidth, WALL_HEIGHT, WALL_THICKNESS], [x, WALL_HEIGHT / 2, z], wallMaterial);
      } else {
        const segmentDepth = depth * (end - start);
        const z = z1 + depth * (start + end) / 2;
        const x = x1 + (side === "east" ? width : 0);
        addBox(root, [WALL_THICKNESS, WALL_HEIGHT, segmentDepth], [x, WALL_HEIGHT / 2, z], wallMaterial);
      }
    };

    for (const side of ["north", "east", "south", "west"] as const) {
      const openings = wallItems.filter(item => item.roomId === room.id && item.wall === side)
        .map(item => ({ item, start: Math.max(0, (item.offset - item.width / 2) / 100), end: Math.min(1, (item.offset + item.width / 2) / 100) }))
        .sort((a, b) => a.start - b.start);
      let cursor = 0;
      for (const opening of openings) {
        addWall(side, cursor, opening.start);
        const length = (side === "north" || side === "south" ? width : depth) * (opening.end - opening.start);
        const center = (opening.start + opening.end) / 2;
        const acrossX = side === "north" || side === "south";
        const wallX = acrossX ? x1 + width * center : x1 + (side === "east" ? width : 0);
        const wallZ = acrossX ? z1 + (side === "south" ? depth : 0) : z1 + depth * center;
        const material = opening.item.type === "door"
          ? new THREE.MeshStandardMaterial({ color: 0x88633f, roughness: 0.68, side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color: 0x9acbd6, metalness: 0.15, roughness: 0.16, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const openingHeight = opening.item.type === "door" ? 2.15 : 1.15;
        const openingY = opening.item.type === "door" ? openingHeight / 2 : 1.55;
        const dims: [number, number, number] = acrossX ? [length, openingHeight, 0.045] : [0.045, openingHeight, length];
        addBox(root, dims, [wallX, openingY, wallZ], material);
        cursor = Math.max(cursor, opening.end);
      }
      addWall(side, cursor, 1);
    }
  }

  for (const item of plan.furniture || []) {
    const room = roomById.get(item.roomId);
    if (!room) continue;
    const roomX = room.width * WORLD_SCALE; const roomZ = room.height * WORLD_SCALE;
    const sizeX = Math.max(0.16, item.width / 100 * roomX * 0.9);
    const sizeZ = Math.max(0.16, item.height / 100 * roomZ * 0.9);
    const x = (room.x - 50) * WORLD_SCALE + item.x / 100 * roomX + sizeX / 2;
    const z = (room.y - 50) * WORLD_SCALE + item.y / 100 * roomZ + sizeZ / 2;
    const isBed = /giường/i.test(item.type);
    const isSofa = /sofa/i.test(item.type);
    const height = isBed ? 0.48 : isSofa ? 0.72 : /bàn/i.test(item.type) ? 0.78 : 1.1;
    const color = isBed ? 0xd6c6ae : isSofa ? 0x788897 : /bàn/i.test(item.type) ? 0x96734d : 0x9a876d;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
    const furniture = addBox(root, [sizeX, height, sizeZ], [x, height / 2 + 0.05, z], material, item.rotation * Math.PI / 180);
    furniture.userData.label = item.name;
  }

  if (!rooms.length) {
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xd7d9dc, roughness: 1 }));
    floorMesh.position.y = -0.02; root.add(floorMesh);
  }

  scene.add(root);
}

function disposeGroup(group: THREE.Group) {
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
  });
  group.removeFromParent();
}

function moveCameraWithKeyboard(viewer: ViewerState, key: string) {
  const spherical = new THREE.Spherical().setFromVector3(viewer.camera.position.clone().sub(viewer.controls.target));
  switch (key) {
    case "ArrowLeft": spherical.theta += 0.12; break;
    case "ArrowRight": spherical.theta -= 0.12; break;
    case "ArrowUp": spherical.phi -= 0.12; break;
    case "ArrowDown": spherical.phi += 0.12; break;
    case "+": case "=": spherical.radius *= 0.9; break;
    case "-": case "_": spherical.radius *= 1.1; break;
    default: return false;
  }
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI * 0.49);
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, viewer.controls.minDistance, viewer.controls.maxDistance);
  viewer.camera.position.copy(viewer.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  viewer.camera.lookAt(viewer.controls.target);
  viewer.controls.update();
  return true;
}

export default function ArchitecturePlan3DViewer({ plan, floor, fallback, canGenerateAi = false, rendering = false, onGenerateRender }: {
  plan: ArchitecturePlan;
  floor: number;
  fallback: ReactNode;
  canGenerateAi?: boolean;
  rendering?: boolean;
  onGenerateRender?: (image: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerState | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>("isometric");
  const [captureError, setCaptureError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window.WebGLRenderingContext === "undefined") return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(tokenColor("surface-container-lowest", "#ffffff"));
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
    camera.position.set(17, 14, 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0); controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 7; controls.maxDistance = 48; controls.maxPolarAngle = Math.PI * 0.49;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const ambient = new THREE.HemisphereLight(0xf5f5f5, 0x7d756b, 2.1); scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xfff2d7, 3.2); keyLight.position.set(-9, 18, 12); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    const shadowCamera = keyLight.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -14; shadowCamera.right = 14; shadowCamera.top = 14; shadowCamera.bottom = -14;
    scene.add(keyLight);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; ground.receiveShadow = true; scene.add(ground);
    renderer.domElement.setAttribute("role", "application");
    renderer.domElement.setAttribute("aria-label", `Mô hình 3D kiến trúc tầng ${floor}`);
    renderer.domElement.setAttribute("aria-describedby", `architecture-3d-controls-${floor}`);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.className = "block h-full w-full focus-visible:outline-2 focus-visible:outline-primary";
    const onCanvasKeyDown = (event: KeyboardEvent) => {
      const viewer = viewerRef.current;
      if (viewer && moveCameraWithKeyboard(viewer, event.key)) event.preventDefault();
    };
    renderer.domElement.addEventListener("keydown", onCanvasKeyDown);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(1, container.clientWidth); const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let frame = 0;
    const draw = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(draw); };
    draw();
    viewerRef.current = { renderer, scene, camera, controls };
    setWebglAvailable(true);

    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener("keydown", onCanvasKeyDown);
      const roomGroup = scene.getObjectByName("architecture-plan");
      if (roomGroup instanceof THREE.Group) disposeGroup(roomGroup);
      ground.geometry.dispose(); (ground.material as THREE.Material).dispose();
      renderer.dispose(); renderer.domElement.remove(); viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.renderer.domElement.setAttribute("aria-label", `Mô hình 3D kiến trúc tầng ${floor}`);
    const current = viewer.scene.getObjectByName("architecture-plan");
    if (current instanceof THREE.Group) disposeGroup(current);
    buildRoomScene(plan, floor, viewer.scene);
  }, [plan, floor, webglAvailable]);

  const setCamera = (next: CameraPreset) => {
    const viewer = viewerRef.current; if (!viewer) return;
    const positions: Record<CameraPreset, [number, number, number]> = {
      isometric: [17, 14, 20], front: [0, 7, 25], top: [0, 32, 0.01],
    };
    viewer.camera.position.set(...positions[next]); viewer.controls.target.set(0, 0.8, 0); viewer.controls.update(); setPreset(next);
  };
  const download = () => {
    const renderer = viewerRef.current?.renderer; if (!renderer) return;
    const link = document.createElement("a"); link.download = `mat-bang-3d-tang-${floor}.png`; link.href = renderer.domElement.toDataURL("image/png"); link.click();
  };
  const generateRender = () => {
    const renderer = viewerRef.current?.renderer; if (!renderer || !onGenerateRender) return;
    try { setCaptureError(""); onGenerateRender(renderer.domElement.toDataURL("image/png")); }
    catch { setCaptureError("Không chụp được góc nhìn 3D. Hãy thử lại hoặc tải ảnh xuống."); }
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Góc nhìn mô hình 3D">
        <button type="button" aria-pressed={preset === "isometric"} disabled={!webglAvailable} onClick={() => setCamera("isometric")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Phối cảnh</button>
        <button type="button" aria-pressed={preset === "front"} disabled={!webglAvailable} onClick={() => setCamera("front")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Mặt trước</button>
        <button type="button" aria-pressed={preset === "top"} disabled={!webglAvailable} onClick={() => setCamera("top")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Từ trên</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canGenerateAi && <button type="button" onClick={generateRender} disabled={!webglAvailable || rendering} aria-busy={rendering} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Sparkles className="size-4" aria-hidden="true" />{rendering ? "Đang tạo…" : "Tạo phối cảnh từ góc 3D"}</button>}
        <button type="button" onClick={download} disabled={!webglAvailable} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Download className="size-4" aria-hidden="true" />Tải ảnh 3D</button>
      </div>
    </div>
    <div className="relative aspect-video overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div ref={containerRef} className="absolute inset-0" />
      {!webglAvailable && <div className="absolute inset-0">{fallback}</div>}
      {webglAvailable && <div id={`architecture-3d-controls-${floor}`} className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-surface-container-lowest/90 px-2 py-1 text-xs text-on-surface-variant"><Rotate3D className="size-3.5" aria-hidden="true" />Kéo để xoay · Cuộn để thu/phóng · Tab vào mô hình rồi dùng phím mũi tên, +/−</div>}
    </div>
    {captureError && <p role="alert" className="text-pretty text-xs text-error">{captureError}</p>}
    {!webglAvailable && <p role="status" className="text-pretty text-xs text-on-surface-variant">Trình duyệt không hỗ trợ WebGL; đang hiển thị bản xem khối tĩnh.</p>}
  </div>;
}
