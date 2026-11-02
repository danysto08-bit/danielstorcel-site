import type { BufferGeometry, Material, Mesh, Object3D, Texture, Vector3 } from 'three';

export interface ScopeAPI {
  setProgress(p: number): void;
  setPointer(x: number, y: number): void;
  resize(): void;
  start(): void;
  stop(): void;
  project(key: string): { x: number; y: number; visible: boolean; opacity: number };
  dispose(): void;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

export async function createScope(
  canvas: HTMLCanvasElement,
  opts: { reduced: boolean; onFrame?: () => void },
): Promise<ScopeAPI | null> {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, antialias: true }) ||
      canvas.getContext('webgl', { alpha: true, antialias: true });
  } catch { return null; }
  if (!gl) return null;
  const T = await import('three');
  const renderer = new T.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x0c0c0d, 16, 36);
  scene.add(new T.AmbientLight(0xffffff, 0.35));
  const key = new T.DirectionalLight(0xffffff, 1.3);
  key.position.set(5, 8, 6); scene.add(key);
  const rim = new T.DirectionalLight(0xff8a5c, 0.25);
  rim.position.set(-6, 3, -4); scene.add(rim);
  const nanoFill = new T.DirectionalLight(0xffffff, 0);
  nanoFill.position.set(2, 4, 6); scene.add(nanoFill);
  const floor = new T.GridHelper(16, 32, 0x2a2a2e, 0x1c1c1f);
  floor.position.y = -1.35;
  for (const m of Array.isArray(floor.material) ? floor.material : [floor.material]) {
    m.transparent = true; m.opacity = 0.6;
  }
  scene.add(floor);

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const geometry = <G extends BufferGeometry>(g: G) => { geometries.add(g); return g; };
  const material = <M extends Material>(m: M) => { materials.add(m); return m; };
  type Painted = { mat: Material; opacity: number };
  type Part = { group: Object3D; home: Vector3; explode: Vector3; paint: Painted[] };
  const parts: Part[] = [];
  const inst = new T.Group();
  const nano = new T.Group();
  scene.add(inst, nano);
  const body = () => material(new T.MeshStandardMaterial({
    color: 0x1b1b1e, roughness: 0.55, metalness: 0.35, transparent: true,
  }));
  const light = () => material(new T.MeshStandardMaterial({
    color: 0x26262a, roughness: 0.55, metalness: 0.35, transparent: true,
  }));
  const zinc = () => material(new T.MeshStandardMaterial({
    color: 0xe4471c, emissive: 0xff4f1f, emissiveIntensity: 0.28, roughness: 0.45, metalness: 0.1, transparent: true,
  }));
  const edgeCache = new WeakMap<BufferGeometry, BufferGeometry>();
  function solid(parent: Object3D, geo: BufferGeometry, mat: Material, x: number, y: number, z: number, opacity = 1) {
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    let edge = edgeCache.get(geo);
    if (!edge) { edge = geometry(new T.EdgesGeometry(geo, 22)); edgeCache.set(geo, edge); }
    const outline = material(new T.LineBasicMaterial({ color: 0xf3efe7, transparent: true, opacity: 0.42 }));
    mesh.add(new T.LineSegments(edge, outline));
    mat.transparent = true; mat.opacity = opacity;
    return mesh;
  }
  function part(x: number, y: number, z: number, dx: number, dy: number, dz: number) {
    const g = new T.Group(); g.position.set(x, y, z); inst.add(g);
    const p: Part = { group: g, home: g.position.clone(), explode: new T.Vector3(dx, dy, dz), paint: [] };
    parts.push(p);
    return p;
  }
  function painted(p: Part, geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0, opacity = 1) {
    const mesh = solid(p.group, geo, mat, x, y, z, opacity);
    p.paint.push({ mat, opacity });
    const lines = mesh.children[0] as Object3D & { material: Material };
    p.paint.push({ mat: lines.material, opacity: 0.42 });
    return mesh;
  }
  const box = (x: number, y: number, z: number) => geometry(new T.BoxGeometry(x, y, z));
  const cylinder = (a: number, b: number, h: number) => geometry(new T.CylinderGeometry(a, b, h, 20));
  const torus = (r: number, tube: number) => geometry(new T.TorusGeometry(r, tube, 8, 32));

  // The chamber is an open-front cutaway so the stage and detectors remain visible.
  const chamber = part(0, 0, 0, 0, -2.2, 0);
  painted(chamber, box(4.2, 0.1, 3), body(), 0, -0.95, 0);
  painted(chamber, box(0.1, 2.4, 3), body(), -2.05, 0.25, 0, 0.72);
  painted(chamber, box(0.1, 2.4, 3), body(), 2.05, 0.25, 0, 0.72);
  painted(chamber, box(4.2, 2.4, 0.08), body(), 0, 0.25, -1.46, 0.72);
  painted(chamber, box(4.4, 0.08, 3.2), light(), 0, 1.48, 0, 0.72);
  painted(chamber, box(1.3, 1.1, 0.05), light(), -1.35, 0.05, 1.5, 0.32);
  const viewport = painted(chamber, torus(0.28, 0.035), light(), -1.35, 0.05, 1.54);
  viewport.rotation.x = 0;
  const boltGeo = cylinder(0.065, 0.065, 0.07);
  for (let i = 0; i < 6; i++) painted(chamber, boltGeo, light(), -1.75 + i * 0.7, 1.55, 1.3);
  const footGeo = cylinder(0.16, 0.16, 0.22);
  for (const x of [-1.7, 1.7]) for (const z of [-1.15, 1.15])
    painted(chamber, footGeo, light(), x, -1.11, z);

  const objective = part(0, 1.75, 0, 0, 2.5, 0);
  painted(objective, cylinder(0.32, 0.72, 0.6), light());
  painted(objective, cylinder(0.3, 0.1, 0.35), light(), 0, -1.13, 0);
  const segmentGeo = cylinder(0.32, 0.32, 0.55);
  const flangeGeo = cylinder(0.42, 0.42, 0.06);
  for (let i = 0; i < 4; i++) {
    const p = part(0, 2.32 + i * 0.6, 0, 0, 2.3 - i * 0.1, 0);
    painted(p, segmentGeo, body()); painted(p, flangeGeo, light(), 0, -0.28, 0);
  }
  const coils = part(0, 0, 0, 0, 2, 0);
  for (const y of [2.92, 3.52]) {
    const coil = painted(coils, torus(0.52, 0.11), light(), 0, y, 0);
    coil.rotation.x = Math.PI / 2;
  }
  painted(coils, box(0.26, 0.32, 0.24), light(), 0.42, 3.04, 0);
  const gun = part(0, 4.92, 0, 0, 2.1, 0);
  painted(gun, cylinder(0.46, 0.46, 0.75), light());
  painted(gun, cylinder(0.51, 0.51, 0.07), light(), 0, 0.4, 0);
  for (const x of [-0.55, 0.55]) {
    const stub = painted(gun, cylinder(0.05, 0.05, 0.28), light(), x, 0.15, 0);
    stub.rotation.z = Math.PI / 2;
  }

  const angle = 52 * Math.PI / 180;
  const ion = part(0, 0, 0, 2, 1.6, 0);
  (ion.group as Object3D).rotation.z = -angle;
  const ionSeg = cylinder(0.24, 0.24, 0.55);
  for (let i = 0; i < 3; i++) {
    painted(ion, ionSeg, body(), 0, 0.775 + i * 0.63, 0);
    painted(ion, cylinder(0.31, 0.31, 0.06), light(), 0, 0.5 + i * 0.63, 0);
  }
  painted(ion, cylinder(0.20, 0.20, 0.8), body(), 0, 2.72, 0);
  painted(ion, cylinder(0.36, 0.36, 0.6), light(), 0, 3.4, 0);
  painted(ion, cylinder(0.40, 0.40, 0.08), light(), 0, 1.48 / Math.cos(angle), 0);
  const ionCoil = painted(ion, torus(0.35, 0.06), light(), 0, 1.65, 0);
  ionCoil.rotation.x = Math.PI / 2;

  const etd = part(-1.05, 0.35, 0.3, -1.5, 0, 0);
  const det = painted(etd, cylinder(0.12, 0.12, 0.35), light());
  det.rotation.z = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const ring = painted(etd, torus(0.14, 0.01), light(), 0.14 + i * 0.05, 0, 0);
    ring.rotation.y = Math.PI / 2;
  }
  const edx = part(1.05, 0.48, 0.15, 1.5, 0, 0);
  const tube = painted(edx, cylinder(0.07, 0.07, 1.4), light());
  tube.rotation.z = -Math.PI / 3;
  const edxFlange = painted(edx, cylinder(0.16, 0.16, 0.06), light(), 0.56, 0.32, 0);
  edxFlange.rotation.z = -Math.PI / 3;
  const ccd = part(1.4, 0.9, -1.1, 1.5, 0, 0);
  painted(ccd, box(0.28, 0.22, 0.22), light());
  const base = part(0, -1.05, 0, 0, -1.8, 0);
  painted(base, box(2, 0.1, 1.4), light());
  for (let i = 0; i < 3; i++) {
    const p = part(0, -0.88 + i * 0.22, 0, 0, -1.8, 0);
    painted(p, box(1.1 - i * 0.2, 0.18, 0.8 - i * 0.1), light());
    if (i < 2) painted(p, cylinder(0.45, 0.45, 0.05), body(), 0, 0.12, 0);
  }
  const plate = part(0, -0.22, 0, 0, -1.8, 0);
  painted(plate, box(1.4, 0.08, 0.9), light());
  const stub = part(0, -0.14, 0, 0, -1.8, 0);
  painted(stub, cylinder(0.14, 0.14, 0.1), light());
  const chip = part(0, -0.015, 0, 0, -1.8, 0);
  painted(chip, box(0.3, 0.03, 0.3), zinc());

  function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, w = 512, h = 512) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    const tex = new T.CanvasTexture(c); textures.add(tex); return tex;
  }
  const speckle = canvasTexture((ctx) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 140; i++) {
      const rand = (n: number) => { const v = Math.sin(n * 91.137) * 43758.5453; return v - Math.floor(v); };
      ctx.beginPath(); ctx.ellipse(rand(i + 1) * 512, rand(i + 400) * 512, 2 + rand(i + 50) * 5, 2 + rand(i + 90) * 5, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(25,25,28,.7)'; ctx.stroke();
    }
  });
  const hatch = canvasTexture((ctx) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(42,20,12,.85)';
    for (let x = -512; x < 1024; x += 24) { ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + 512, 0); ctx.stroke(); }
  });
  const nanoPaint: Painted[] = [];
  const silicon = () => material(new T.MeshStandardMaterial({
    color: 0x3a3a41, map: speckle, roughness: 0.7, transparent: true,
  }));
  const copper = () => material(new T.MeshStandardMaterial({
    color: 0x7a4b32, map: hatch, roughness: 0.5, metalness: 0.45, transparent: true,
  }));
  function nanoSolid(geo: BufferGeometry, mat: Material, x: number, y: number, z: number, parent: Object3D = nano) {
    const m = solid(parent, geo, mat, x, y, z);
    nanoPaint.push({ mat, opacity: 1 });
    nanoPaint.push({ mat: (m.children[0] as Object3D & { material: Material }).material, opacity: 0.42 });
    return m;
  }
  function layered(x: number, z: number, w: number, d: number) {
    return [
      nanoSolid(box(w, 0.33, d), copper(), x, -0.435, z),
      nanoSolid(box(w, 0.835, d), silicon(), x, 0.1475, z),
      nanoSolid(box(w, 0.035, d), zinc(), x, 0.5825, z),
    ];
  }
  layered(-0.925, 0, 0.55, 1.6);
  layered(0.925, 0, 0.55, 1.6);
  layered(0, -0.55, 1.3, 0.5);
  const floorCuGeo = box(1.3, 1, 1.1); floorCuGeo.translate(0, 0.5, 0);
  const floorSiGeo = box(1.3, 1, 1.1); floorSiGeo.translate(0, 0.5, 0);
  const floorCu = nanoSolid(floorCuGeo, copper(), 0, -0.6, 0.25);
  const floorSi = nanoSolid(floorSiGeo, silicon(), 0, -0.27, 0.25);
  const floorCap = nanoSolid(box(1.3, 0.035, 1.1), zinc(), 0, 0.5825, 0.25);

  const dash = canvasTexture((ctx) => {
    ctx.clearRect(0, 0, 8, 8); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 3);
  }, 8, 8);
  dash.wrapS = dash.wrapT = T.RepeatWrapping; dash.repeat.set(1, 7);
  const glowTexture = canvasTexture((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,190,130,1)'); g.addColorStop(0.25, 'rgba(255,79,31,.8)'); g.addColorStop(1, 'rgba(255,79,31,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  }, 64, 64);
  function beam(color: number, radius: number, dashed: boolean) {
    const mat = material(new T.MeshBasicMaterial({ color, map: dashed ? dash : null, transparent: true, depthWrite: false, opacity: 0 }));
    const m = new T.Mesh(cylinder(radius, radius, 1), mat); scene.add(m); return { mesh: m, mat };
  }
  const eBeam = beam(0xf3efe7, 0.006, true), iBeam = beam(0xff4f1f, 0.015, false);
  const nanoIonBeam = beam(0xff4f1f, 0.022, true);
  const nanoIonCore = beam(0xff4f1f, 0.016, false);
  const nanoIonDirection = new T.Vector3(0.3 * Math.sin(angle), Math.cos(angle), 0.954 * Math.sin(angle)).normalize();
  function alignBeam(b: Mesh, from: Vector3, to: Vector3) {
    const delta = from.clone().sub(to);
    b.position.copy(from).add(to).multiplyScalar(0.5);
    b.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
    b.scale.y = delta.length();
  }
  const impactMat = material(new T.SpriteMaterial({ map: glowTexture, color: 0xff4f1f, transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false }));
  const impact = new T.Sprite(impactMat); impact.renderOrder = 10; scene.add(impact);
  const impactLight = new T.PointLight(0xff4f1f, 0, 1.5); scene.add(impactLight);
  const arcPoints = Array.from({ length: 24 }, (_, i) => {
    const a = angle * i / 23;
    return new T.Vector3(Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0.02);
  });
  const arcGeometry = geometry(new T.BufferGeometry().setFromPoints(arcPoints));
  const arcMaterial = material(new T.LineDashedMaterial({ color: 0xf3efe7, transparent: true, opacity: 0, dashSize: 0.035, gapSize: 0.025 }));
  const arc = new T.Line(arcGeometry, arcMaterial); arc.computeLineDistances(); scene.add(arc);
  const scanMat = material(new T.MeshBasicMaterial({ color: 0xff4f1f, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  const scanLine = new T.Mesh(geometry(new T.PlaneGeometry(1.3, 0.035)), scanMat); scanLine.position.z = -0.294; nano.add(scanLine);
  const scanGlowMaterial = material(new T.SpriteMaterial({ map: glowTexture, color: 0xff4f1f, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const scanGlow = new T.Sprite(scanGlowMaterial); scanGlow.position.z = -0.29; scanGlow.scale.setScalar(0.5); nano.add(scanGlow);
  const scaleBar = nanoSolid(box(0.3, 0.01, 0.01), light(), 0.95, -0.62, 0.85);
  const particleGeometry = geometry(new T.BufferGeometry());
  const positions = new Float32Array(60 * 3);
  particleGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const particleMat = material(new T.PointsMaterial({ color: 0xff4f1f, size: 0.03, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const spray = new T.Points(particleGeometry, particleMat); nano.add(spray);
  let meshCount = 0;
  scene.traverse((object) => { if (object instanceof T.Mesh) meshCount++; });
  canvas.dataset.meshCount = String(meshCount);

  const camera = new T.PerspectiveCamera(36, 1, 0.05, 40);
  const posCurve = new T.CatmullRomCurve3([new T.Vector3(-7, 1.4, 9.5), new T.Vector3(6.2, 3.8, 8.2), new T.Vector3(5, 2.8, 6)]);
  const targetCurve = new T.CatmullRomCurve3([new T.Vector3(0, 1.2, 0), new T.Vector3(0, 1.6, 0), new T.Vector3(0.2, 1.1, 0)]);
  const actualPos = posCurve.getPoint(0), actualTarget = targetCurve.getPoint(0);
  const anchors: Record<string, Vector3> = {
    chamber: new T.Vector3(-2.1, 1.2, 1.5), eColumn: new T.Vector3(0.55, 3.2, 0),
    iColumn: new T.Vector3(Math.sin(angle) * 2.6 + 0.3, Math.cos(angle) * 2.6, 0),
    detector: new T.Vector3(-1, 0.7, 0.2), edx: new T.Vector3(1.1, 0.55, 0.1),
    stage: new T.Vector3(1, -0.9, 0.7), sample: new T.Vector3(-0.45, 0.02, 0.4),
    beamE: new T.Vector3(0.06, 1.6, 0), beamI: new T.Vector3(1.4, 1.3, 0),
    trench: new T.Vector3(-0.65, 0.62, 0.8), zno: new T.Vector3(0.67, 0.575, -0.28),
    sic: new T.Vector3(0.67, 0.12, -0.28), cu: new T.Vector3(0.67, -0.45, -0.28),
    scale: new T.Vector3(0.95, -0.62, 0.85),
  };
  const partAt: Record<string, number> = { chamber: 0, eColumn: 4, iColumn: 8, detector: 9, edx: 10, stage: 13, sample: parts.length - 1 };
  let progress = 0, px = 0, py = 0, pointerX = 0, pointerY = 0, frame = 0, running = false, last = 0, disposed = false;
  let draw = 0, mill = 0, scan = 0, nanoAlpha = 0, instAlpha = 1, nanoFloorTop = 0;
  function update() {
    draw = clamp(progress / 0.5);
    const beams = clamp((progress - 0.5) / 0.08);
    rim.intensity = 0.25 * beams;
    mill = clamp((progress - 0.78) / 0.12);
    scan = clamp((progress - 0.9) / 0.1);
    instAlpha = 1 - clamp((progress - 0.60) / 0.06);
    nanoAlpha = clamp((progress - 0.70) / 0.08);
    nanoFill.intensity = 0.7 * nanoAlpha;
    parts.forEach((p, i) => {
      const t = smooth((draw - (i / parts.length) * 0.82) / 0.18);
      const eased = 1 - Math.pow(1 - t, 3);
      p.group.position.copy(p.home).addScaledVector(p.explode, 1 - eased);
      p.group.rotation.x = 0.04 * Math.sin(t * Math.PI);
      p.paint.forEach(({ mat, opacity }) => { mat.opacity = opacity * t * instAlpha; });
    });
    inst.visible = progress < 0.66;
    nano.visible = progress >= 0.66;
    const scale = 0.3 + 0.7 * (1 - Math.pow(1 - clamp((progress - 0.66) / 0.12), 3));
    nano.scale.setScalar(scale);
    nanoPaint.forEach(({ mat, opacity }) => { mat.opacity = opacity * nanoAlpha; });
    const depth = mill * 0.95;
    const siHeight = Math.max(0.01, 0.835 - depth);
    const cuHeight = Math.max(0.01, 0.33 - Math.max(0, depth - 0.835));
    floorCu.scale.y = cuHeight; floorSi.position.y = -0.6 + cuHeight; floorSi.scale.y = siHeight;
    floorCap.position.y = -0.6 + cuHeight + siHeight + 0.0175;
    const capOpacity = depth > 0.001 ? 0 : nanoAlpha;
    (floorCap.material as Material).opacity = capOpacity;
    ((floorCap.children[0] as Object3D & { material: Material }).material).opacity = capOpacity * 0.42;
    const floorTop = -0.6 + cuHeight + siHeight;
    nanoFloorTop = floorTop;
    const point = progress >= 0.76 ? new T.Vector3(0, floorTop * scale, -0.05 * scale) : new T.Vector3(0, 0, 0);
    const electronLength = progress >= 0.76 ? 1.8 - point.y : 0.45;
    const ionLength = progress >= 0.76 ? 1.6 : 0.5;
    alignBeam(eBeam.mesh, point.clone().add(new T.Vector3(0, electronLength, 0)), point);
    alignBeam(iBeam.mesh, point.clone().add(new T.Vector3(Math.sin(angle) * ionLength, Math.cos(angle) * ionLength, 0)), point);
    alignBeam(nanoIonBeam.mesh, point.clone().addScaledVector(nanoIonDirection, ionLength), point);
    alignBeam(nanoIonCore.mesh, point.clone().addScaledVector(nanoIonDirection, ionLength), point);
    eBeam.mesh.scale.x = eBeam.mesh.scale.z = progress >= 0.76 ? 1 : 2;
    const beamVisibility = progress < 0.66 ? instAlpha : clamp((progress - 0.76) / 0.04) * nanoAlpha;
    eBeam.mat.opacity = beams * beamVisibility * (progress >= 0.76 ? 0.65 : 0.9);
    iBeam.mat.opacity = progress < 0.76 ? beams * beamVisibility * 0.9 : 0;
    nanoIonBeam.mat.opacity = progress >= 0.76 ? beams * beamVisibility * 0.6 : 0;
    nanoIonCore.mat.opacity = progress >= 0.76 ? beams * beamVisibility * 0.95 : 0;
    impact.position.copy(point); impactLight.position.copy(point);
    const glow = progress < 0.60 ? beams : progress < 0.68 ? 0.8 : progress < 0.76 ? 0.8 * (1 - clamp((progress - 0.68) / 0.08)) : beams * nanoAlpha;
    impactLight.intensity = glow * 1.2; impactMat.opacity = glow;
    impactMat.depthTest = progress < 0.60 || progress >= 0.76;
    arcMaterial.opacity = beams * instAlpha * 0.45;
    scanLine.position.y = 0.6 - scan * 1.2; scanMat.opacity = scan > 0 ? nanoAlpha * 0.9 : 0;
    scanGlow.position.y = scanLine.position.y; scanGlowMaterial.opacity = scan > 0 ? nanoAlpha * 0.5 : 0;
    particleMat.opacity = mill > 0 && mill < 1 ? nanoAlpha : 0;
    scaleBar.visible = scan > 0;
  }
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function tick(now: number) {
    if (!running || disposed) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05); last = now;
    update();
    let dest: Vector3, target: Vector3;
    if (progress <= 0.5) {
      dest = posCurve.getPoint(smooth(progress / 0.5));
      target = targetCurve.getPoint(smooth(progress / 0.5));
    } else {
      const keys = [
        { p: 0.5, pos: new T.Vector3(5, 2.8, 6), target: new T.Vector3(0.2, 1.1, 0) },
        { p: 0.58, pos: new T.Vector3(3.8, 1.9, 4.6), target: new T.Vector3(0, 0.5, 0) },
        { p: 0.66, pos: new T.Vector3(1.2, 1.1, 1.6), target: new T.Vector3(0, 0.05, 0) },
        { p: 0.78, pos: new T.Vector3(2.16, 2.758, 4.852), target: new T.Vector3(0, -0.05, 0.1) },
        { p: 1, pos: new T.Vector3(1.296, 2.564, 5.14), target: new T.Vector3(0, -0.1, 0.1) },
      ];
      const i = Math.min(keys.length - 2, Math.max(0, keys.findIndex((k, n) => n > 0 && progress <= k.p) - 1));
      const a = keys[i], b = keys[i + 1], t = smooth((progress - a.p) / (b.p - a.p));
      dest = a.pos.clone().lerp(b.pos, t); target = a.target.clone().lerp(b.target, t);
    }
    pointerX += (px - pointerX) * 0.06; pointerY += (py - pointerY) * 0.06;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    target.y += 1.3 * (1 - smooth((progress - 0.58) / 0.08));
    if (mobile) target.y += 1.3 * smooth((progress - 0.3) / 0.25);
    const orbit = dest.sub(target);
    let framing = 1 + (1 - smooth((progress - 0.58) / 0.08));
    if (mobile) framing += 1.1 * smooth((progress - 0.45) / 0.17);
    orbit.multiplyScalar(framing);
    if (!opts.reduced) orbit.applyAxisAngle(new T.Vector3(0, 1, 0), pointerX * 0.25 + 0.03 * Math.sin(now * 0.00035));
    orbit.y += opts.reduced ? 0 : -pointerY * 0.12 * orbit.length();
    dest = orbit.add(target);
    actualPos.lerp(dest, 0.12); actualTarget.lerp(target, 0.12);
    camera.position.copy(actualPos); camera.lookAt(actualTarget); camera.updateMatrixWorld();
    const fov = 36 + 6 * smooth((progress - 0.66) / 0.12);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    dash.offset.y -= dt * 1.2;
    const pulse = 0.35 + 0.08 * Math.sin(now * 0.018);
    const glowScale = progress < 0.6 ? pulse : progress < 0.68
      ? 0.35 + 4.15 * clamp((progress - 0.6) / 0.08)
      : progress < 0.76 ? 4.5 - 4.14 * clamp((progress - 0.68) / 0.08) : 0.36;
    impact.scale.setScalar(glowScale);
    for (let i = 0; i < 60; i++) {
      const life = ((now / 1000 + i * 0.137) % 0.8);
      positions[i * 3] = Math.sin(i * 17.3) * life * 0.5;
      positions[i * 3 + 1] = (impact.position.y / (nano.scale.y || 1)) + life * (1.4 - life);
      positions[i * 3 + 2] = -0.05 + Math.cos(i * 9.1) * life * 0.35;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    canvas.dataset.renderCalls = String(renderer.info.render.calls);
    opts.onFrame?.();
    frame = requestAnimationFrame(tick);
  }
  resize();
  return {
    setProgress(p) { progress = clamp(p); },
    setPointer(x, y) { px = clamp((x + 1) / 2) * 2 - 1; py = clamp((y + 1) / 2) * 2 - 1; },
    resize,
    start() { if (!running && !disposed) { running = true; last = performance.now(); frame = requestAnimationFrame(tick); } },
    stop() { running = false; cancelAnimationFrame(frame); },
    project(key) {
      const anchor = anchors[key];
      if (!anchor) return { x: 0, y: 0, visible: false, opacity: 0 };
      const beamLabel = key === 'beamE' || key === 'beamI';
      const isNano = !(key in partAt) && (!beamLabel || progress >= 0.66);
      const point = beamLabel && !isNano
        ? key === 'beamE' ? new T.Vector3(-0.12, 0.3, 0) : new T.Vector3(Math.sin(angle) * 1.1 + 0.1, Math.cos(angle) * 1.1, 0)
        : key === 'beamI' ? new T.Vector3(nanoIonDirection.x * 1.6 + 0.08, nanoFloorTop + nanoIonDirection.y * 1.6 + 0.08, -0.05 + nanoIonDirection.z * 1.6)
        : anchor.clone();
      if (isNano) point.multiplyScalar(nano.scale.x);
      const v = point.project(camera);
      const opacity = isNano
        ? nanoAlpha * (key === 'zno' ? clamp(scan / 0.1) : key === 'sic' ? clamp((scan - 0.35) / 0.1) : key === 'cu' ? clamp((scan - 0.75) / 0.1) : 1)
        : beamLabel ? clamp((progress - 0.5) / 0.08) * instAlpha
          : smooth((draw - (partAt[key] / parts.length) * 0.82) / 0.18) * instAlpha;
      return {
        x: (v.x + 1) * canvas.clientWidth / 2, y: (1 - v.y) * canvas.clientHeight / 2,
        visible: v.z >= -1 && v.z <= 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
        opacity: opacity * (1 - clamp((progress - 0.62) / 0.04) * (1 - clamp((progress - 0.72) / 0.04))),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; running = false; cancelAnimationFrame(frame);
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose()); floor.geometry.dispose();
      for (const m of Array.isArray(floor.material) ? floor.material : [floor.material]) m.dispose();
      renderer.dispose();
    },
  };
}
