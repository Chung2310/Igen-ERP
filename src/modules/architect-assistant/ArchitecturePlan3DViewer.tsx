import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Download, Rotate3D, Sparkles } from "lucide-react";
import type { ArchitectureOpening, ArchitecturePlan, ArchitectureRoom } from "../../shared/architecture-assistant";

type CameraPreset = "isometric" | "front" | "top" | "room";
type RoomAspectRatio = "4:3" | "16:9" | "1:1";
type ThreeDRenderMode = "interior" | "floorplan";
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
    const label = `${item.type} ${item.name}`.toLocaleLowerCase("vi");
    const isBed = /giường|bed/.test(label);
    const isSofa = /sofa/.test(label);
    const isNightstand = /tủ đầu giường|nightstand/.test(label);
    const isFridge = /tủ lạnh|fridge/.test(label);
    const isWasher = /máy giặt|máy sấy|washing machine/.test(label);
    const isWardrobe = /tủ|wardrobe|cabinet/.test(label);
    const isKitchen = /bếp|cooktop/.test(label);
    const isDesk = /bàn làm việc|desk/.test(label);
    const isTable = /bàn|table/.test(label);
    const isBath = /thiết bị vệ sinh|bồn cầu|toilet|lavabo|chậu rửa|bồn rửa|sink|bath/.test(label);
    const isStairs = /cầu thang|stairs/.test(label);
    const isPlant = /chậu cây|cây cảnh|plant/.test(label);
    const isCar = /ô tô|xe|car|vehicle/.test(label);
    const furniture = new THREE.Group();
    furniture.position.set(x, 0.04, z); furniture.rotation.y = -item.rotation * Math.PI / 180;
    furniture.userData.label = item.name; root.add(furniture);
    const materialColors: Record<string, number> = {
      natural_oak: 0xc8a578, dark_walnut: 0x5c4033, painted_white: 0xf2f0e9,
      fabric_grey: 0x87929b, fabric_green: 0x426954, beige_fabric: 0xc6b79f,
      marble: 0xd4d9dc, stainless_steel: 0xaab4ba, black_metal: 0x343a3d,
    };
    const selectedMaterialColor = item.color && /^#[0-9a-f]{6}$/i.test(item.color)
      ? new THREE.Color(item.color)
      : item.material && materialColors[item.material] !== undefined ? new THREE.Color(materialColors[item.material]) : undefined;
    const fabricMaterial = item.material?.startsWith("fabric_") || item.material === "beige_fabric";
    const metalMaterial = item.material === "stainless_steel" || item.material === "black_metal";
    const whiteMaterial = item.material === "painted_white";
    const woodColor = selectedMaterialColor && !fabricMaterial && !metalMaterial
      ? selectedMaterialColor : new THREE.Color(isBed || isWardrobe || isNightstand || isTable || isDesk ? 0x96734d : 0x9a876d);
    const fabricColor = selectedMaterialColor && fabricMaterial
      ? selectedMaterialColor : new THREE.Color(isSofa ? 0x788897 : 0xd6c6ae);
    const wood = new THREE.MeshStandardMaterial({ color: woodColor, roughness: item.material === "marble" ? 0.24 : 0.68 });
    const fabric = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.92 });
    const white = new THREE.MeshStandardMaterial({ color: whiteMaterial && selectedMaterialColor ? selectedMaterialColor : 0xf0eee8, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: metalMaterial && selectedMaterialColor ? selectedMaterialColor : 0x9da8ad, metalness: 0.72, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: item.material === "black_metal" && selectedMaterialColor ? selectedMaterialColor : 0x30373a, roughness: 0.28, metalness: 0.32 });
    const part = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => addBox(furniture, size, position, material);
    const cylinder = (radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20), material);
      mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; furniture.add(mesh);
    };

    if (isBed) {
      const bedWidth = item.style === "crib" ? sizeX * 0.58 : sizeX;
      const bedDepth = item.style === "crib" ? sizeZ * 0.62 : sizeZ;
      part([bedWidth, 0.22, bedDepth], [0, 0.13, 0], wood);
      part([bedWidth * 0.94, 0.2, bedDepth * 0.93], [0, 0.33, 0], white);
      part([bedWidth, 0.78, 0.12], [0, 0.52, -bedDepth * 0.45], wood);
      part([bedWidth * 0.96, 0.12, bedDepth * 0.36], [0, 0.49, bedDepth * 0.24], fabric);
      part([bedWidth * 0.31, 0.09, bedDepth * 0.16], [-bedWidth * 0.24, 0.48, -bedDepth * 0.29], white);
      if (item.style !== "crib") part([bedWidth * 0.31, 0.09, bedDepth * 0.16], [bedWidth * 0.24, 0.48, -bedDepth * 0.29], white);
    } else if (isSofa) {
      part([sizeX, 0.34, sizeZ * 0.82], [0, 0.28, sizeZ * 0.08], fabric);
      part([sizeX, 0.62, 0.16], [0, 0.66, -sizeZ * 0.4], fabric);
      part([sizeX * 0.14, 0.53, sizeZ * 0.9], [-sizeX * 0.43, 0.39, 0], fabric);
      part([sizeX * 0.14, 0.53, sizeZ * 0.9], [sizeX * 0.43, 0.39, 0], fabric);
      if (item.style === "sectional") part([sizeX * 0.42, 0.32, sizeZ * 0.48], [sizeX * 0.27, 0.31, sizeZ * 0.34], fabric);
    } else if (isFridge) {
      const height = 1.8;
      part([sizeX, height, sizeZ], [0, height / 2, 0], white);
      part([0.025, height * 0.48, 0.025], [sizeX * 0.36, height * 0.74, sizeZ * 0.52], metal);
      part([sizeX * 0.86, 0.025, 0.025], [0, height * 0.55, sizeZ * 0.52], metal);
    } else if (isWasher) {
      part([sizeX, 0.88, sizeZ], [0, 0.44, 0], white);
      cylinder(sizeX * 0.28, sizeX * 0.28, 0.035, [0, 0.47, sizeZ * 0.51], metal);
      cylinder(sizeX * 0.2, sizeX * 0.2, 0.04, [0, 0.47, sizeZ * 0.53], dark);
    } else if (isBath) {
      if (/bồn cầu|toilet/.test(label)) {
        part([sizeX * 0.7, 0.48, sizeZ * 0.7], [0, 0.24, 0], white);
        cylinder(sizeX * 0.37, sizeX * 0.42, 0.28, [0, 0.48, sizeZ * 0.1], white);
        part([sizeX * 0.62, 0.58, sizeZ * 0.2], [0, 0.3, -sizeZ * 0.36], white);
      } else {
        part([sizeX, 0.72, sizeZ], [0, 0.36, 0], white);
        part([sizeX * 0.74, 0.025, sizeZ * 0.72], [0, 0.74, 0], metal);
      }
    } else if (isNightstand || isWardrobe) {
      const height = isNightstand ? 0.52 : 2.05;
      part([sizeX, height, sizeZ], [0, height / 2, 0], wood);
      part([sizeX * 0.92, height * 0.92, 0.025], [0, height / 2, sizeZ * 0.51], white);
      part([0.035, isNightstand ? 0.07 : 0.16, 0.035], [0, height * 0.56, sizeZ * 0.54], metal);
    } else if (isKitchen) {
      part([sizeX, 0.72, sizeZ], [0, 0.36, 0], wood);
      part([sizeX * 1.02, 0.07, sizeZ * 1.02], [0, 0.755, 0], dark);
      for (const side of [-1, 1]) {
        cylinder(sizeX * 0.13, sizeX * 0.13, 0.025, [side * sizeX * 0.22, 0.8, 0], metal);
      }
    } else if (isDesk || isTable) {
      const topY = 0.75;
      part([sizeX, 0.07, sizeZ], [0, topY, 0], wood);
      for (const sideX of [-1, 1]) for (const sideZ of [-1, 1]) {
        part([0.055, topY, 0.055], [sideX * sizeX * 0.43, topY / 2, sideZ * sizeZ * 0.42], dark);
      }
    } else if (isStairs) {
      const stepCount = 7;
      const stepDepth = sizeZ / stepCount;
      for (let index = 0; index < stepCount; index += 1) {
        const stepHeight = 0.18 * (index + 1);
        part([sizeX, stepHeight, stepDepth], [0, stepHeight / 2, -sizeZ / 2 + stepDepth * (index + 0.5)], wood);
      }
      if (item.style?.startsWith("l_shaped") || item.style === "u_shaped") {
        const sideCount = item.style === "u_shaped" ? 5 : 4;
        const stepWidth = sizeX / sideCount;
        for (let index = 0; index < sideCount; index++) {
          const stepHeight = 0.18 * (stepCount - index);
          part([stepWidth, stepHeight, sizeZ * 0.34], [-sizeX / 2 + stepWidth * (index + 0.5), stepHeight / 2, sizeZ * 0.33], wood);
        }
        if (item.style === "u_shaped") for (let index = 0; index < sideCount; index++) {
          const stepHeight = 0.18 * (index + 1);
          part([stepWidth, stepHeight, sizeZ * 0.34], [sizeX / 2 - stepWidth * (index + 0.5), stepHeight / 2, sizeZ * 0.33], wood);
        }
      }
    } else if (isPlant) {
      cylinder(sizeX * 0.28, sizeX * 0.36, 0.34, [0, 0.18, 0], new THREE.MeshStandardMaterial({ color: 0xa55331, roughness: 0.8 }));
      cylinder(0.045, 0.06, 0.72, [0, 0.7, 0], wood);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.2, Math.min(sizeX, sizeZ) * 0.42), 16, 12), new THREE.MeshStandardMaterial({ color: 0x527b4a, roughness: 0.86 }));
      leaves.position.set(0, 1.15, 0); leaves.castShadow = true; furniture.add(leaves);
    } else if (isCar) {
      const suv = item.style === "suv";
      const vehicleHeight = suv ? 0.58 : 0.46;
      part([sizeX, vehicleHeight, sizeZ], [0, vehicleHeight * 0.87, 0], new THREE.MeshStandardMaterial({ color: 0x526b7a, metalness: 0.58, roughness: 0.3 }));
      part([sizeX * (suv ? 0.82 : 0.78), 0.42, sizeZ * (suv ? 0.58 : 0.48)], [0, vehicleHeight + 0.19, -sizeZ * 0.04], new THREE.MeshStandardMaterial({ color: 0x9ab5c3, metalness: 0.2, roughness: 0.18, transparent: true, opacity: 0.78 }));
      const wheelGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16); wheelGeometry.rotateZ(Math.PI / 2);
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.92 });
      for (const wheelX of [-sizeX * 0.48, sizeX * 0.48]) for (const wheelZ of [-sizeZ * 0.3, sizeZ * 0.3]) {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial); wheel.position.set(wheelX, 0.24, wheelZ); wheel.castShadow = true; furniture.add(wheel);
      }
    } else {
      part([sizeX, 0.82, sizeZ], [0, 0.41, 0], wood);
      part([sizeX * 0.9, 0.035, 0.025], [0, 0.42, sizeZ * 0.51], metal);
    }
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
  onGenerateRender?: (image: string, mode: ThreeDRenderMode, aspectRatio: RoomAspectRatio) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerState | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>("isometric");
  const [roomViewId, setRoomViewId] = useState("");
  const [roomCameraX, setRoomCameraX] = useState(50);
  const [roomCameraY, setRoomCameraY] = useState(50);
  const [roomRotation, setRoomRotation] = useState(0);
  const [roomFov, setRoomFov] = useState(85);
  const [aspectRatio, setAspectRatio] = useState<RoomAspectRatio>("4:3");
  const [renderMode, setRenderMode] = useState<ThreeDRenderMode>("interior");
  const [captureError, setCaptureError] = useState("");
  const floorRooms = plan.rooms.filter(room => room.floor === floor);
  const floorRoomIds = floorRooms.map(room => room.id).join("|");

  useEffect(() => {
    if (!floorRooms.some(room => room.id === roomViewId)) setRoomViewId(floorRooms[0]?.id || "");
  }, [floor, floorRoomIds, roomViewId]);

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

  const setCamera = (next: Exclude<CameraPreset, "room">) => {
    const viewer = viewerRef.current; if (!viewer) return;
    const positions: Record<Exclude<CameraPreset, "room">, [number, number, number]> = {
      isometric: [17, 14, 20], front: [0, 7, 25], top: [0, 32, 0.01],
    };
    viewer.camera.fov = 42; viewer.camera.updateProjectionMatrix();
    viewer.camera.position.set(...positions[next]); viewer.controls.target.set(0, 0.8, 0);
    viewer.controls.minDistance = 7; viewer.controls.maxDistance = 48; viewer.controls.maxPolarAngle = Math.PI * 0.49;
    viewer.controls.update(); setPreset(next);
  };
  const positionRoomCamera = (id = roomViewId, rotation = roomRotation, fov = roomFov, xPercent = roomCameraX, yPercent = roomCameraY) => {
    const viewer = viewerRef.current;
    const room = floorRooms.find(item => item.id === id);
    if (!viewer || !room) return false;
    const centerX = (room.x + room.width * xPercent / 100 - 50) * WORLD_SCALE;
    const centerZ = (room.y + room.height * yPercent / 100 - 50) * WORLD_SCALE;
    const angle = THREE.MathUtils.degToRad(rotation);
    const target = new THREE.Vector3(centerX, 1.55, centerZ);
    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const eye = target.clone().addScaledVector(direction, -0.05);
    viewer.camera.fov = fov; viewer.camera.updateProjectionMatrix();
    viewer.camera.position.copy(eye); viewer.controls.target.copy(target);
    viewer.controls.minDistance = 0.01; viewer.controls.maxDistance = 0.1; viewer.controls.minPolarAngle = 0.05; viewer.controls.maxPolarAngle = Math.PI - 0.05;
    viewer.camera.lookAt(target); viewer.controls.update();
    setPreset("room");
    return true;
  };
  useEffect(() => {
    if (preset === "room") positionRoomCamera();
  }, [plan, floor, roomViewId, roomCameraX, roomCameraY, roomRotation, roomFov, webglAvailable, preset]);
  const previewAspectClass = preset !== "room" && renderMode !== "floorplan" ? "aspect-video" : aspectRatio === "1:1" ? "aspect-square" : aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-video";
  const download = () => {
    const renderer = viewerRef.current?.renderer; if (!renderer) return;
    const link = document.createElement("a"); link.download = `mat-bang-3d-tang-${floor}.png`; link.href = renderer.domElement.toDataURL("image/png"); link.click();
  };
  const captureRender = (mode: ThreeDRenderMode) => {
    const renderer = viewerRef.current?.renderer; if (!renderer || !onGenerateRender) return;
    try { setCaptureError(""); onGenerateRender(renderer.domElement.toDataURL("image/png"), mode, aspectRatio); }
    catch { setCaptureError("Không chụp được góc nhìn 3D. Hãy thử lại hoặc tải ảnh xuống."); }
  };
  const generateRender = () => {
    if (renderMode === "floorplan") {
      setCamera("top");
      requestAnimationFrame(() => captureRender(renderMode));
      return;
    }
    captureRender(renderMode);
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Góc nhìn mô hình 3D">
        <button type="button" aria-pressed={preset === "isometric"} disabled={!webglAvailable} onClick={() => setCamera("isometric")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Phối cảnh</button>
        <button type="button" aria-pressed={preset === "front"} disabled={!webglAvailable} onClick={() => setCamera("front")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Mặt trước</button>
        <button type="button" aria-pressed={preset === "top"} disabled={!webglAvailable} onClick={() => setCamera("top")} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Từ trên</button>
        <button type="button" aria-pressed={preset === "room"} disabled={!webglAvailable || !floorRooms.length} aria-describedby={!floorRooms.length ? "architecture-room-camera-help" : undefined} onClick={() => positionRoomCamera()} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Góc nhìn phòng</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canGenerateAi && <>
          <label className="sr-only" htmlFor={`architecture-3d-render-mode-${floor}`}>Chế độ render 3D</label>
          <select id={`architecture-3d-render-mode-${floor}`} className="min-h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" value={renderMode} onChange={event => setRenderMode(event.target.value as ThreeDRenderMode)} disabled={!webglAvailable || rendering}>
            <option value="interior">Phối cảnh nội thất</option><option value="floorplan">Mặt bằng 3D</option>
          </select>
          <button type="button" onClick={generateRender} disabled={!webglAvailable || rendering} aria-busy={rendering} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Sparkles className="size-4" aria-hidden="true" />{rendering ? "Đang tạo…" : renderMode === "floorplan" ? "Tạo mặt bằng 3D" : "Tạo phối cảnh từ góc 3D"}</button>
        </>}
        <button type="button" onClick={download} disabled={!webglAvailable} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><Download className="size-4" aria-hidden="true" />Tải ảnh 3D</button>
      </div>
    </div>
    {preset === "room" && <div className="grid gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Phòng nhìn</span><select className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus-visible:outline-2 focus-visible:outline-primary" value={roomViewId} onChange={event => { const id = event.target.value; setRoomViewId(id); setRoomCameraX(50); setRoomCameraY(50); positionRoomCamera(id, roomRotation, roomFov, 50, 50); }}>{floorRooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Vị trí ngang trong phòng · {roomCameraX}%</span><input className="block min-h-9 w-full accent-primary focus-visible:outline-2 focus-visible:outline-primary" type="range" min="5" max="95" step="1" value={roomCameraX} onChange={event => { const value = Number(event.target.value); setRoomCameraX(value); positionRoomCamera(roomViewId, roomRotation, roomFov, value); }} /></label>
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Vị trí sâu trong phòng · {roomCameraY}%</span><input className="block min-h-9 w-full accent-primary focus-visible:outline-2 focus-visible:outline-primary" type="range" min="5" max="95" step="1" value={roomCameraY} onChange={event => { const value = Number(event.target.value); setRoomCameraY(value); positionRoomCamera(roomViewId, roomRotation, roomFov, roomCameraX, value); }} /></label>
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Hướng camera · {roomRotation}°</span><input className="block min-h-9 w-full accent-primary focus-visible:outline-2 focus-visible:outline-primary" type="range" min="0" max="359" step="1" value={roomRotation} onChange={event => { const value = Number(event.target.value); setRoomRotation(value); positionRoomCamera(roomViewId, value); }} /></label>
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Tầm nhìn · {roomFov}°</span><input className="block min-h-9 w-full accent-primary focus-visible:outline-2 focus-visible:outline-primary" type="range" min="30" max="120" step="5" value={roomFov} onChange={event => { const value = Number(event.target.value); setRoomFov(value); positionRoomCamera(roomViewId, roomRotation, value); }} /></label>
      <label className="block space-y-1 text-xs text-on-surface-variant"><span>Tỷ lệ khung hình</span><select className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus-visible:outline-2 focus-visible:outline-primary" value={aspectRatio} onChange={event => setAspectRatio(event.target.value as RoomAspectRatio)}><option value="4:3">Landscape (4:3)</option><option value="16:9">Widescreen (16:9)</option><option value="1:1">Square (1:1)</option></select></label>
    </div>}
    {!floorRooms.length && <p id="architecture-room-camera-help" className="text-pretty text-xs text-on-surface-variant">Thêm ít nhất một phòng ở tầng này để dùng góc camera trong phòng.</p>}
    <div className={`relative ${previewAspectClass} overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest`}>
      <div ref={containerRef} className="absolute inset-0" />
      {!webglAvailable && <div className="absolute inset-0">{fallback}</div>}
      {webglAvailable && <div id={`architecture-3d-controls-${floor}`} className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-surface-container-lowest/90 px-2 py-1 text-xs text-on-surface-variant"><Rotate3D className="size-3.5" aria-hidden="true" />Kéo để xoay · Cuộn để thu/phóng · Tab vào mô hình rồi dùng phím mũi tên, +/−</div>}
    </div>
    {captureError && <p role="alert" className="text-pretty text-xs text-error">{captureError}</p>}
    {!webglAvailable && <p role="status" className="text-pretty text-xs text-on-surface-variant">Trình duyệt không hỗ trợ WebGL; đang hiển thị bản xem khối tĩnh.</p>}
  </div>;
}
