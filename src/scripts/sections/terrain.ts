import type * as ThreeT from 'three';
import traunsteinUrl from '../../assets/dem/traunstein.png?url';
import gerlachUrl from '../../assets/dem/gerlach.png?url';
import montblancUrl from '../../assets/dem/montblanc.png?url';
import metadata from '../../assets/dem/dem.json';
import { decodeDem } from '../dem';
import { stateAt } from './summit-state';

export { stateAt } from './summit-state';

type Projection = { x: number; y: number; visible: boolean };
export interface TerrainAPI {
  setProgress(p: number): void;
  setPointer(x: number, y: number): void;
  resize(): void;
  start(): void;
  stop(): void;
  project(peakIndex: number): Projection & { weight: number };
  projectPoint(point: ThreeT.Vector3): Projection;
  routePoints(): ThreeT.Vector3[];
  dispose(): void;
}

const W = 100;
const DEM_SIZE = 256;
const urls = [traunsteinUrl, gerlachUrl, montblancUrl];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const maskAt = (u: number, v: number) => 1 - smooth((Math.hypot(u - .5, v - .5) * 2 - .72) / .28);

export async function createTerrain(
  canvas: HTMLCanvasElement,
  opts: { reduced?: boolean; mobile?: boolean } = {}
): Promise<TerrainAPI | null> {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;
  let maps: Float32Array[];
  try {
    maps = await Promise.all(urls.map(async (url, index) => {
      const elevations = await decodeDem(url);
      const summit = metadata[index].summit;
      const decoded = elevations[summit.row * DEM_SIZE + summit.col];
      if (Math.abs(decoded - summit.elev) > 2) throw new Error(`${metadata[index].id} DEM summit mismatch: ${decoded} vs ${summit.elev}`);
      return elevations;
    }));
  } catch (error) {
    console.warn('Summit DEM unavailable:', error);
    return null;
  }
  const THREE = await import('three');
  const host = canvas.parentElement as HTMLElement;
  const gridSize = opts.mobile ? 96 : 192;
  const count = gridSize * gridSize;
  const step = W / (gridSize - 1);
  const scales = metadata.map((peak) => W / (peak.boxKm * 1000) * 1.6);

  function elevAt(k: number, u: number, v: number) {
    const x = clamp(u) * (DEM_SIZE - 1), y = clamp(v) * (DEM_SIZE - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(DEM_SIZE - 1, x0 + 1), y1 = Math.min(DEM_SIZE - 1, y0 + 1);
    const tx = x - x0, ty = y - y0;
    const data = maps[k];
    const a = data[y0 * DEM_SIZE + x0] * (1 - tx) + data[y0 * DEM_SIZE + x1] * tx;
    const b = data[y1 * DEM_SIZE + x0] * (1 - tx) + data[y1 * DEM_SIZE + x1] * tx;
    return a * (1 - ty) + b * ty;
  }
  function worldY(k: number, u: number, v: number) {
    return (elevAt(k, u, v) - metadata[k].base) * scales[k] * maskAt(u, v);
  }

  const elevations = new Float32Array(count * 3);
  const heights = new Float32Array(count * 3);
  for (let row = 0; row < gridSize; row++) {
    const v = row / (gridSize - 1);
    for (let col = 0; col < gridSize; col++) {
      const u = col / (gridSize - 1), offset = (row * gridSize + col) * 3;
      for (let k = 0; k < 3; k++) {
        elevations[offset + k] = elevAt(k, u, v);
        heights[offset + k] = worldY(k, u, v);
      }
    }
  }
  const normals = [0, 1, 2].map((k) => {
    const values = new Float32Array(count * 3);
    const at = (row: number, col: number) => heights[(row * gridSize + col) * 3 + k];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const l = Math.max(0, col - 1), r = Math.min(gridSize - 1, col + 1);
        const t = Math.max(0, row - 1), b = Math.min(gridSize - 1, row + 1);
        const dx = (at(row, r) - at(row, l)) / ((r - l) * step);
        const dz = (at(b, col) - at(t, col)) / ((b - t) * step);
        const inv = 1 / Math.hypot(dx, 1, dz), offset = (row * gridSize + col) * 3;
        values[offset] = -dx * inv;
        values[offset + 1] = inv;
        values[offset + 2] = -dz * inv;
      }
    }
    return values;
  });
  const geometry = new THREE.PlaneGeometry(W, W, gridSize - 1, gridSize - 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('aH', new THREE.BufferAttribute(heights, 3));
  geometry.setAttribute('aE', new THREE.BufferAttribute(elevations, 3));
  normals.forEach((values, k) => geometry.setAttribute(`aN${k}`, new THREE.BufferAttribute(values, 3)));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uMorph: { value: 0 }, uBuild: { value: 0 }, uLevel: { value: 0 },
      uGlow: { value: 0 }, uRoute: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-.55, .8, .3).normalize() },
      uSummitElev: { value: 4808 }, uGridN: { value: gridSize - 1 },
      uBase: { value: new THREE.Color('#060607') },
      uSlope: { value: new THREE.Color('#141418') },
      uBone: { value: new THREE.Color('#efeae0') },
      uAccent: { value: new THREE.Color('#ff4f1f') },
      uWarm: { value: new THREE.Color('#ff6a3a') },
      uFogNear: { value: 100 }, uFogFar: { value: 245 },
    },
    vertexShader: `
      attribute vec3 aH, aE, aN0, aN1, aN2;
      uniform float uMorph, uBuild;
      varying float vE, vDist, vMask;
      varying vec3 vN;
      varying vec2 vUv;
      void main() {
        float f = uMorph < 1.0 ? uMorph : uMorph - 1.0;
        float h = uMorph < 1.0 ? mix(aH.x, aH.y, f) : mix(aH.y, aH.z, f);
        vE = uMorph < 1.0 ? mix(aE.x, aE.y, f) : mix(aE.y, aE.z, f);
        vec3 normalAtPeak = uMorph < 1.0 ? mix(aN0, aN1, f) : mix(aN1, aN2, f);
        vN = normalize(mix(vec3(0.0, 1.0, 0.0), normalAtPeak, uBuild));
        vUv = uv;
        vMask = 1.0 - smoothstep(0.72, 1.0, length((uv - 0.5) * 2.0));
        vec3 p = vec3(position.x, h * uBuild, position.z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uLevel, uGlow, uSummitElev, uGridN, uFogNear, uFogFar;
      uniform vec3 uSunDir, uBase, uSlope, uBone, uAccent, uWarm;
      varying float vE, vDist, vMask;
      varying vec3 vN;
      varying vec2 vUv;
      float contour(float interval) {
        float h = vE / interval;
        float d = abs(fract(h + 0.5) - 0.5);
        return 1.0 - smoothstep(0.0, max(fwidth(h) * 1.2, 0.0001), d);
      }
      void main() {
        vec2 cell = vUv * uGridN;
        vec2 d = abs(fract(cell + 0.5) - 0.5) / max(fwidth(cell), vec2(0.0001));
        float grid = 1.0 - clamp(min(d.x, d.y), 0.0, 1.0);
        float lit = step(vE, uLevel);
        float minor = contour(100.0);
        float major = contour(500.0);
        float lines = max(minor * mix(0.14, 0.35, lit), major * mix(0.32, 0.85, lit));
        float delta = uLevel - vE;
        float w = max(fwidth(vE) * 0.65, 0.001);
        float level = 1.0 - smoothstep(0.0, w, abs(delta));
        float below = step(0.0, delta) * (1.0 - smoothstep(0.0, 10.0, delta));
        float ndl = max(0.0, dot(normalize(vN), uSunDir));
        float warm = pow(ndl, 2.0) * 0.35 * 1.4 * uGlow * smoothstep(uSummitElev - 900.0, uSummitElev, vE);
        float summitGlow = 0.26 * uGlow * smoothstep(uSummitElev - 120.0, uSummitElev, vE);
        float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDist);
        float gridFade = 1.0 - smoothstep(40.0, 160.0, vDist);
        vec3 color = mix(uBase, uSlope, pow(ndl, 1.5) * 0.9);
        color = mix(color, uBone, clamp(lines + grid * 0.035 * gridFade, 0.0, 1.0));
        color = mix(color, uWarm, clamp(warm * 0.25 + summitGlow * 0.3, 0.0, 1.0));
        color = mix(color, uAccent, clamp(level + below * 0.15, 0.0, 1.0));
        float alpha = mix(0.96, 1.0, level) * fog * vMask;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  material.depthWrite = true;
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
  scene.add(camera);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d')!;
  const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.2, 'rgba(255,255,255,.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const summitPoints = metadata.map((peak, k) => {
    const u = peak.summit.col / (DEM_SIZE - 1), v = peak.summit.row / (DEM_SIZE - 1);
    return new THREE.Vector3((u - .5) * W, worldY(k, u, v), (v - .5) * W);
  });
  const waypoints = metadata[2].route!.map((point) => {
    const u = point.col / (DEM_SIZE - 1), v = point.row / (DEM_SIZE - 1);
    return new THREE.Vector3((u - .5) * W, worldY(2, u, v) + .6, (v - .5) * W);
  });
  const routeCurve = new THREE.CatmullRomCurve3(waypoints);
  const routeSamples = routeCurve.getPoints(119);
  routeSamples.forEach((point) => {
    point.y = worldY(2, point.x / W + .5, point.z / W + .5) + .6;
  });
  const routeGeometry = new THREE.BufferGeometry().setFromPoints(routeSamples);
  routeGeometry.setDrawRange(0, 0);
  const routeMaterial = new THREE.LineBasicMaterial({ color: 0xff4f1f, transparent: true, opacity: 0, depthWrite: false, depthTest: !opts.reduced });
  const routeLine = new THREE.Line(routeGeometry, routeMaterial);
  routeLine.frustumCulled = false;
  scene.add(routeLine);
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = ringCanvas.height = 64;
  const ringContext = ringCanvas.getContext('2d')!;
  ringContext.strokeStyle = '#efeae0';
  ringContext.lineWidth = 1.5;
  ringContext.beginPath();
  ringContext.arc(32, 32, 22, 0, Math.PI * 2);
  ringContext.stroke();
  ringContext.fillStyle = '#efeae0';
  ringContext.beginPath();
  ringContext.arc(32, 32, 3, 0, Math.PI * 2);
  ringContext.fill();
  const ringTexture = new THREE.CanvasTexture(ringCanvas);
  const huts = waypoints.map((point) => {
    const hutMaterial = new THREE.SpriteMaterial({
      map: ringTexture, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: !opts.reduced,
    });
    const hut = new THREE.Sprite(hutMaterial);
    hut.position.copy(point).add(new THREE.Vector3(0, .4, 0));
    hut.scale.setScalar(1.1);
    hut.visible = false;
    scene.add(hut);
    return hut;
  });

  const summitGlowMaterial = new THREE.SpriteMaterial({
    map: glowTexture, color: 0xff4f1f, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const summitGlowSprite = new THREE.Sprite(summitGlowMaterial);
  summitGlowSprite.position.copy(waypoints[waypoints.length - 1]);
  summitGlowSprite.scale.setScalar(1.3);
  scene.add(summitGlowSprite);

  const snowCount = opts.reduced || opts.mobile ? 0 : 700;
  const flakes = new Float32Array(snowCount * 3);
  const resetFlake = (index: number, initial = false) => {
    flakes[index * 3] = (Math.random() - .5) * 100;
    flakes[index * 3 + 1] = initial ? (Math.random() - .5) * 60 : 30;
    flakes[index * 3 + 2] = -12 - Math.random() * 88;
  };
  for (let i = 0; i < snowCount; i++) resetFlake(i, true);
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  snowGeometry.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from({ length: snowCount }, () => .5 + Math.random() * .9), 1));
  snowGeometry.setDrawRange(0, 0);
  const snowMaterial = new THREE.PointsMaterial({
    color: 0xefeae0, size: 1.1, sizeAttenuation: true, map: glowTexture,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  snowMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float aSize;\n${shader.vertexShader}`.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
  };
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  snow.frustumCulled = false;
  snow.visible = false;
  camera.add(snow);
  const snowWorld = new THREE.Vector3();
  const clouds = opts.mobile || opts.reduced ? [] : Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI * 2 / 10;
    const cloudMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xefeae0, transparent: true, opacity: .07, depthWrite: false });
    const cloud = new THREE.Sprite(cloudMaterial);
    cloud.position.set(summitPoints[2].x + Math.cos(angle) * 15, (3300 - metadata[2].base) * scales[2], summitPoints[2].z + Math.sin(angle) * 15);
    cloud.scale.set(14, 2.5, 1);
    cloud.visible = false;
    scene.add(cloud);
    return cloud;
  });

  const [traunstein, gerlach, montblanc] = summitPoints;
  const times = [0, .1, .34, .42, .66, .74, 1];
  const positions = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10, 22, 95),
    new THREE.Vector3(-40, 20, 70),
    new THREE.Vector3(traunstein.x + (30 - traunstein.x) * .88, 20, traunstein.z + (60 - traunstein.z) * .88),
    new THREE.Vector3(-45, 38, 72),
    new THREE.Vector3(35, 42, 58),
    new THREE.Vector3(-60, 22, 95),
    new THREE.Vector3(montblanc.x - 22, montblanc.y + 10, montblanc.z + 40),
  ]);
  const targets = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 6, 0),
    new THREE.Vector3(traunstein.x, traunstein.y * .6, traunstein.z),
    new THREE.Vector3(traunstein.x, traunstein.y - 6, traunstein.z),
    gerlach.clone().multiplyScalar(.7),
    gerlach.clone().multiplyScalar(.8),
    montblanc.clone().multiplyScalar(.6),
    montblanc.clone(),
  ]);
  function curveAt(curve: ThreeT.CatmullRomCurve3, p: number, target: ThreeT.Vector3) {
    let index = 0;
    while (index < times.length - 2 && p > times[index + 1]) index++;
    const t = (index + (p - times[index]) / (times[index + 1] - times[index])) / (times.length - 1);
    return curve.getPoint(clamp(t), target);
  }
  let current = stateAt(0);
  let px = 0, py = 0, raf = 0, lastFrame = 0;
  let running = false, disposed = false;
  const camPos = positions.getPoint(0), camTgt = targets.getPoint(0);
  const desired = new THREE.Vector3(), desiredTgt = new THREE.Vector3();
  const staticPos = new THREE.Vector3(montblanc.x - 28, montblanc.y + 20, montblanc.z + 105);
  const staticTarget = new THREE.Vector3(montblanc.x - 10, montblanc.y - 26, montblanc.z);

  function resize() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.setViewOffset(width, height, opts.reduced ? 0 : width * .08, 0, width, height);
  }
  function frame(time: number) {
    if (!running || disposed) return;
    const dt = Math.min(.05, (time - lastFrame) / 1000 || .016);
    lastFrame = time;
    if (opts.reduced) { desired.copy(staticPos); desiredTgt.copy(staticTarget); }
    else { curveAt(positions, current.p, desired); curveAt(targets, current.p, desiredTgt); }
    const idle = opts.reduced || opts.mobile ? 0 : Math.sin(time / 12000) * .5;
    desired.x += px * 1.5 + idle;
    desired.y -= py * 1.5;
    desiredTgt.x += px * .6;
    desiredTgt.y -= py * .6;
    const lerp = Math.min(1, (1 - Math.pow(.001, dt)) * 1.4);
    if (opts.mobile || opts.reduced) { camPos.copy(desired); camTgt.copy(desiredTgt); }
    else { camPos.lerp(desired, lerp); camTgt.lerp(desiredTgt, lerp); }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    camera.updateMatrixWorld();
    if (snow.visible && !opts.mobile && !opts.reduced) {
      for (let i = 0; i < snowCount; i++) {
        const j = i * 3;
        flakes[j] += Math.sin(time / 1400 + flakes[j + 2] * .1) * .9 * dt;
        flakes[j + 1] -= 2.2 * dt;
        snowWorld.set(flakes[j], flakes[j + 1], flakes[j + 2]).applyMatrix4(camera.matrixWorld);
        const u = snowWorld.x / W + .5, v = snowWorld.z / W + .5;
        const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
        if (flakes[j + 1] < -30 || Math.abs(flakes[j]) > 50 ||
          (inside && snowWorld.y < worldY(2, u, v) * current.build)) resetFlake(i);
      }
      snowGeometry.attributes.position.needsUpdate = true;
    }
    clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(time / 5000 + i) * .12 * dt; });
    renderer.render(scene, camera);
    const calls = String(renderer.info.render.calls);
    if (canvas.dataset.drawCalls !== calls) canvas.dataset.drawCalls = calls;
    raf = requestAnimationFrame(frame);
  }
  function projectPoint(point: ThreeT.Vector3): Projection {
    const v = point.clone().project(camera);
    return { x: (v.x + 1) / 2 * host.clientWidth, y: (1 - v.y) / 2 * host.clientHeight, visible: v.z >= -1 && v.z <= 1 };
  }
  resize();
  return {
    setProgress(p) {
      current = stateAt(p);
      material.uniforms.uMorph.value = current.morph;
      material.uniforms.uBuild.value = current.build;
      material.uniforms.uLevel.value = current.altitude;
      material.uniforms.uGlow.value = current.glow;
      material.uniforms.uRoute.value = current.route;
      canvas.dataset.morph = current.morph.toFixed(3);
      canvas.dataset.level = Math.round(current.altitude).toString();
      canvas.dataset.route = current.route.toFixed(3);
      canvas.dataset.chapter = String(current.chapter);
      routeGeometry.setDrawRange(0, Math.floor(current.route * routeSamples.length));
      const routeFade = smooth((current.morph - 1.6) / .4);
      routeMaterial.opacity = .95 * routeFade;
      routeLine.visible = current.route > 0 && routeFade > 0;
      huts.forEach((hut, i) => {
        hut.visible = current.route > 0 && current.route >= i / (huts.length - 1) && routeFade > 0;
        hut.material.opacity = routeFade;
      });
      summitGlowSprite.visible = current.route >= .99;
      summitGlowMaterial.opacity = current.glow * .65;
      clouds.forEach((cloud) => { cloud.visible = current.morph > 1.7; });
      const amount = opts.reduced ? 0 : current.snow;
      snowGeometry.setDrawRange(0, Math.floor(snowCount * amount));
      snowMaterial.opacity = (opts.mobile ? .35 : .55) * amount;
      snow.visible = snowMaterial.opacity > 0;
    },
    setPointer(x, y) { if (!opts.mobile && !opts.reduced) { px = x; py = y; } },
    resize,
    start() {
      if (running || disposed) return;
      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    project(k) {
      const point = summitPoints[k].clone();
      const u = point.x / W + .5, v = point.z / W + .5;
      const first = current.morph < 1 ? 0 : 1;
      const f = current.morph - first;
      point.y = (worldY(first, u, v) * (1 - f) + worldY(first + 1, u, v) * f) * current.build;
      return { ...projectPoint(point), weight: 1 - Math.min(1, Math.abs(current.morph - k) / .35) };
    },
    projectPoint,
    routePoints() { return waypoints.map((point) => point.clone()); },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      routeGeometry.dispose();
      routeMaterial.dispose();
      huts.forEach((hut) => hut.material.dispose());
      summitGlowMaterial.dispose();
      clouds.forEach((cloud) => cloud.material.dispose());
      snowGeometry.dispose();
      snowMaterial.dispose();
      glowTexture.dispose();
      ringTexture.dispose();
      renderer.dispose();
    },
  };
}
