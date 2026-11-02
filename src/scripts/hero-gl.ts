export interface HeroGL {
  setReveal(value: number): void;
  setScroll(value: number): void;
  setVelocity(value: number): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export async function createHeroGL(frame: HTMLElement, img: HTMLImageElement): Promise<HeroGL | null> {
  if (document.documentElement.classList.contains('no-gl')) return null;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const source = new Image();
  source.src = img.currentSrc || img.src;
  try {
    await source.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
  if (!gl) return null;
  const T = await import('three');
  const renderer = new T.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const texture = new T.Texture(source);
  texture.colorSpace = T.SRGBColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const plane = new T.PlaneGeometry(2, 2);
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;
  const flowMaterial = new T.ShaderMaterial({
    uniforms: {
      uPrev: { value: null },
      uPointer: { value: new T.Vector2(-1, -1) },
      uDirection: { value: new T.Vector2() },
      uStrength: { value: 0 },
      uAspect: { value: 1 },
      uReset: { value: 1 },
    },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uPrev;
      uniform vec2 uPointer, uDirection;
      uniform float uStrength, uAspect, uReset;
      void main() {
        if (uReset > 0.5) {
          gl_FragColor = vec4(0.5, 0.5, 0.0, 1.0);
          return;
        }
        vec4 previous = texture2D(uPrev, vUv);
        vec2 delta = vUv - uPointer;
        delta.x *= uAspect;
        float splat = exp(-dot(delta, delta) / (0.168 * 0.168)) * uStrength;
        float strength = min(1.0, previous.b * 0.965 + splat);
        vec2 velocity = (previous.rg * 2.0 - 1.0) * previous.b * 0.965 + uDirection * splat;
        vec2 direction = clamp(velocity / max(strength, 0.0001), -1.0, 1.0);
        gl_FragColor = vec4(direction * 0.5 + 0.5, strength, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    blending: T.NoBlending,
  });
  const flowScene = new T.Scene();
  flowScene.add(new T.Mesh(plane, flowMaterial));
  const material = new T.ShaderMaterial({
    uniforms: {
      uTex: { value: texture },
      uRes: { value: new T.Vector2(1, 1) },
      uImgRes: { value: new T.Vector2(source.naturalWidth, source.naturalHeight) },
      uTime: { value: 0 },
      uReveal: { value: reduced ? 1 : 0 },
      uScale: { value: 1 },
      uVel: { value: 0 },
      uFlow: { value: null },
      uGrain: { value: 0.035 },
    },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTex, uFlow;
      uniform vec2 uRes, uImgRes;
      uniform float uTime, uReveal, uScale, uVel, uGrain;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float frameAspect = uRes.x / uRes.y;
        float imageAspect = uImgRes.x / uImgRes.y;
        vec2 cover = vec2(min(frameAspect / imageAspect, 1.0), min(imageAspect / frameAspect, 1.0));
        vec2 uv = ((vUv - 0.5) / uScale + 0.5) * cover + (1.0 - cover) * vec2(0.5, 0.65);
        vec4 flow = texture2D(uFlow, vUv);
        vec2 direction = flow.rg * 2.0 - 1.0;
        uv += direction * 0.11 * flow.b * cover;
        vec2 split = direction * 0.011 * flow.b * cover + vec2(0.0, uVel * 0.0025);
        vec3 color = vec3(
          texture2D(uTex, clamp(uv + split, 0.0, 1.0)).r,
          texture2D(uTex, clamp(uv, 0.0, 1.0)).g,
          texture2D(uTex, clamp(uv - split, 0.0, 1.0)).b
        );
        float edge = uReveal * 1.16 - 0.08 + (noise(vUv * 12.0) - 0.5) * 0.04;
        float alpha = smoothstep(1.0 - vUv.y - 0.04, 1.0 - vUv.y + 0.04, edge);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
        gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5) * uGrain;
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new T.Scene();
  scene.add(new T.Mesh(plane, material));
  const flowType = gl.getExtension('EXT_color_buffer_float') ? T.HalfFloatType : T.UnsignedByteType;
  let targets: [import('three').WebGLRenderTarget, import('three').WebGLRenderTarget] | null = null;
  let targetHeight = 0;
  let running = false, disposed = false, raf = 0, previousTime = 0;
  let reveal = reduced ? 1 : 0, scroll = 0, velocity = 0, targetVelocity = 0;
  let currentSource = source.src, loadingSource = '';
  let pointer: { x: number; y: number; time: number } | null = null;

  function updateSource() {
    const url = img.currentSrc || img.src;
    if (!url || url === currentSource || url === loadingSource) return;
    const next = new Image();
    next.src = url;
    loadingSource = url;
    void next.decode().then(() => {
      if (disposed || url !== (img.currentSrc || img.src)) return;
      currentSource = url;
      texture.image = next;
      texture.needsUpdate = true;
      material.uniforms.uImgRes.value.set(next.naturalWidth, next.naturalHeight);
      if (reduced && running) render(performance.now());
    }).catch(() => {}).finally(() => {
      if (loadingSource === url) loadingSource = '';
    });
  }
  function updateScale() {
    material.uniforms.uScale.value = (1.18 - 0.18 * reveal) * (1 + 0.12 * scroll);
  }
  function resize() {
    const width = Math.max(1, frame.clientWidth), height = Math.max(1, frame.clientHeight);
    renderer.setSize(width, height, false);
    material.uniforms.uRes.value.set(canvas.width, canvas.height);
    flowMaterial.uniforms.uAspect.value = width / height;
    const nextHeight = Math.max(1, Math.round(128 * height / width));
    if (!targets || nextHeight !== targetHeight) {
      targets?.forEach((target) => target.dispose());
      const makeTarget = () => new T.WebGLRenderTarget(128, nextHeight, {
        type: flowType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
        depthBuffer: false, stencilBuffer: false,
      });
      targets = [makeTarget(), makeTarget()];
      targetHeight = nextHeight;
      flowMaterial.uniforms.uReset.value = 1;
      for (const target of targets) {
        renderer.setRenderTarget(target);
        renderer.render(flowScene, camera);
      }
      flowMaterial.uniforms.uReset.value = 0;
      renderer.setRenderTarget(null);
      material.uniforms.uFlow.value = targets[0].texture;
    }
    if (reduced && running) render(performance.now());
  }
  function render(now: number) {
    if (!running || disposed || !targets) return;
    const dt = Math.min((now - previousTime) / 1000 || 0.016, 0.05);
    previousTime = now;
    if (!reduced) {
      flowMaterial.uniforms.uPrev.value = targets[0].texture;
      renderer.setRenderTarget(targets[1]);
      renderer.render(flowScene, camera);
      targets.reverse();
      flowMaterial.uniforms.uStrength.value = 0;
      velocity += (targetVelocity - velocity) * 0.08;
    }
    material.uniforms.uFlow.value = targets[0].texture;
    material.uniforms.uVel.value = velocity;
    material.uniforms.uTime.value += dt;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    if (!reduced) raf = requestAnimationFrame(render);
  }
  function onPointer(event: PointerEvent) {
    if (reduced || !running) return;
    const rect = frame.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { pointer = null; return; }
    const now = performance.now();
    if (pointer) {
      const elapsed = Math.max(0.008, (now - pointer.time) / 1000);
      const dx = Math.max(-1, Math.min(1, (x - pointer.x) / elapsed * 0.15));
      const dy = Math.max(-1, Math.min(1, (y - pointer.y) / elapsed * 0.15));
      flowMaterial.uniforms.uPointer.value.set(x, y);
      flowMaterial.uniforms.uDirection.value.set(dx, dy);
      flowMaterial.uniforms.uStrength.value = Math.min(1, Math.hypot(dx, dy) * 4);
    }
    pointer = { x, y, time: now };
  }
  function onLeave() { pointer = null; }
  function onLost(event: Event) {
    event.preventDefault();
    dispose();
    frame.dispatchEvent(new Event('hero-gllost'));
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    pointer = null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('blur', onLeave);
    img.removeEventListener('load', updateSource);
    canvas.removeEventListener('webglcontextlost', onLost);
    targets?.forEach((target) => target.dispose());
    plane.dispose();
    material.dispose();
    flowMaterial.dispose();
    texture.dispose();
    renderer.dispose();
    canvas.remove();
    frame.closest('.hero')?.classList.remove('has-gl');
  }
  const observer = new ResizeObserver(resize);
  observer.observe(frame);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('blur', onLeave);
  img.addEventListener('load', updateSource);
  canvas.addEventListener('webglcontextlost', onLost);
  frame.append(canvas);
  resize();
  updateScale();
  return {
    setReveal(value) { reveal = Math.max(0, Math.min(1, value)); material.uniforms.uReveal.value = reveal; updateScale(); },
    setScroll(value) { scroll = Math.max(0, Math.min(1, value)); updateScale(); },
    setVelocity(value) { targetVelocity = reduced ? 0 : Math.max(-4, Math.min(4, value)); },
    resize,
    start() { if (!running && !disposed) { running = true; previousTime = performance.now(); render(previousTime); } },
    stop,
    dispose,
  };
}
