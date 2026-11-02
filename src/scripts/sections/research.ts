import { gsap, ScrollTrigger } from '../motion';
import { content } from '../../content/site';
import type { Lang } from '../../content/site';
import type { ScopeAPI } from './scope3d';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface ScopeCtl {
  set(p: number): void;
  beams(b: number, animate?: boolean): void;
}
interface XsecCtl {
  set(q: number): void;
}

function buildScope(root: HTMLElement): ScopeCtl {
  const draws = Array.from(root.querySelectorAll<SVGElement>('.scope .draw'));
  const lens = draws.map((el) => {
    const l = (el as SVGGeometryElement).getTotalLength
      ? (el as SVGGeometryElement).getTotalLength()
      : 1500;
    (el as SVGElement).style.strokeDasharray = String(l);
    (el as SVGElement).style.strokeDashoffset = String(l);
    return l;
  });
  const cum: number[] = [];
  let total = 0;
  lens.forEach((l) => { cum.push(total); total += l; });

  const labels = root.querySelectorAll<SVGElement>('.scope [data-at]');
  const beamEls = root.querySelectorAll<SVGElement>('#beamE, #beamI, #impact, #tiltArc');
  const beamLabels = root.querySelectorAll<SVGElement>('.scope .beam-label');
  const impact = root.querySelector<SVGElement>('#impact');
  let dashPhase = 0;
  let flowing = false;
  gsap.ticker.add(() => {
    if (!flowing || root.classList.contains('has-3d')) return;
    dashPhase -= 0.35;
    root.querySelectorAll<SVGElement>('#beamE, #beamI').forEach((b) => {
      b.style.strokeDashoffset = String(dashPhase);
    });
    if (impact) impact.style.opacity = String(0.55 + 0.45 * Math.sin(performance.now() / 220));
  });

  return {
    set(p) {
      const target = p * total;
      draws.forEach((el, i) => {
        const d = clamp01((target - cum[i]) / lens[i]);
        el.style.strokeDashoffset = String(lens[i] * (1 - d));
      });
      labels.forEach((el) => {
        const at = parseFloat(el.dataset.at || '0');
        el.style.opacity = String(clamp01((p - at) / 0.04));
      });
      beamLabels.forEach((el) => {
        const at = parseFloat(el.dataset.at || '0');
        el.style.opacity = String(clamp01((p - at) / 0.04));
      });
    },
    beams(b, animate = true) {
      beamEls.forEach((el) => (el.style.opacity = String(b)));
      beamLabels.forEach((el) => {
        if (b > 0.5) el.style.opacity = '1';
      });
      flowing = b > 0 && animate;
    },
  };
}

function buildXsec(root: HTMLElement): XsecCtl {
  const clipRect = root.querySelector<SVGRectElement>('#trenchClipRect')!;
  const scan = root.querySelector<SVGLineElement>('#scanLine')!;
  const band = root.querySelector<SVGRectElement>('#scanBand')!;
  const open = root.querySelector<SVGElement>('#trenchOpen')!;
  const spray = root.querySelectorAll<SVGElement>('#spray line');
  const fades = root.querySelectorAll<SVGElement>('.xsec [data-xq]');
  const FACE_TOP = 282, FACE_BOT = 510;
  return {
    set(q) {
      clipRect.setAttribute('height', String(clamp01(q / 0.55) * 120));
      open.style.opacity = String(clamp01((q - 0.02) / 0.06) * 0.7 + (q > 0.02 ? 0 : 0));
      fades.forEach((el) => {
        const at = parseFloat(el.dataset.xq || '0');
        el.style.opacity = String(clamp01((q - at) / 0.06));
      });
      spray.forEach((el, i) => {
        el.style.opacity = String(clamp01((q - (0.3 + i * 0.05)) / 0.08));
      });
      const s = clamp01((q - 0.7) / 0.3);
      const y = FACE_TOP + s * (FACE_BOT - FACE_TOP);
      scan.setAttribute('y1', String(y));
      scan.setAttribute('y2', String(y));
      band.setAttribute('y', String(y - 14));
      const show = q > 0.68 ? '1' : '0';
      scan.style.opacity = show;
      band.style.opacity = q > 0.68 ? '0.06' : '0';
    },
  };
}

export function initResearch() {
  const section = document.querySelector<HTMLElement>('#research');
  if (!section) return;
  const lang = (document.body.dataset.lang || 'en') as Lang;
  const R = content[lang].research;

  const scopeEl = section.querySelector<HTMLElement>('.scope')!;
  const xsecEl = section.querySelector<HTMLElement>('.xsec')!;
  const hudPhase = section.querySelector<HTMLElement>('.hud-phase')!;
  const hudRead = section.querySelector<HTMLElement>('.hud-read')!;
  const labelEls = section.querySelectorAll<SVGElement>('.scope [data-at]');
  const canvas = section.querySelector<HTMLCanvasElement>('#scopeCanvas')!;
  const nodes = section.querySelectorAll<HTMLElement>('[data-scope-node]');
  let scene: ScopeAPI | null = null;
  let sceneProgress = 0;
  let syncFallback: (() => void) | null = null;

  const scope = buildScope(section);
  const xsec = buildXsec(section);

  let phaseIdx = -1;
  const setPhase = (i: number) => {
    if (i === phaseIdx) return;
    phaseIdx = i;
    const next = R.scope.phases[i];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hudPhase.textContent = next;
      return;
    }
    gsap.to(hudPhase, {
      yPercent: -60, opacity: 0, duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        hudPhase.textContent = next;
        gsap.fromTo(hudPhase, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
      },
    });
  };

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    let active = true;
    let visible = false;
    let observer: ResizeObserver | undefined;
    let visibilityTrigger: ScrollTrigger | undefined;
    let logged = false;
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width && bounds.height) {
        scene?.setPointer((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
      }
    };
    const onFrame = () => {
      if (!scene) return;
      nodes.forEach((node) => {
        const point = scene!.project(node.dataset.scopeNode || '');
        node.style.left = `${point.x}px`;
        const nudge = node.dataset.scopeNode === 'beamI' && sceneProgress >= 0.78 ? 18 : 0;
        node.style.top = `${point.y + nudge}px`;
        node.style.opacity = String(point.opacity);
        node.style.visibility = point.visible ? 'visible' : 'hidden';
        node.classList.toggle('edge', point.x > canvas.clientWidth * 0.7);
      });
      if (import.meta.env.DEV && !logged && canvas.dataset.renderCalls) {
        console.info(`Research 3D draw calls: ${canvas.dataset.renderCalls}`);
        logged = true;
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      scene?.dispose();
      scene = null;
      section.classList.remove('has-3d');
      syncFallback?.();
      ScrollTrigger.refresh();
    };
    canvas.addEventListener('webglcontextlost', lost);
    window.addEventListener('pointermove', onPointer, { passive: true });
    const pagehide = () => scene?.dispose();
    window.addEventListener('pagehide', pagehide, { once: true });
    visibilityTrigger = ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        visible = self.isActive;
        if (visible) scene?.start(); else scene?.stop();
      },
    });
    visible = visibilityTrigger.isActive;
    void import('./scope3d').then(async ({ createScope }) => {
      const result = await createScope(canvas, { reduced: false, onFrame });
      if (!result) return;
      if (!active) { result.dispose(); return; }
      scene = result;
      section.classList.add('has-3d');
      result.setProgress(sceneProgress);
      result.resize();
      observer = new ResizeObserver(() => result.resize());
      observer.observe(canvas);
      if (visible) result.start();
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    }).catch(() => {
      scene?.dispose();
      scene = null;
      section.classList.remove('has-3d');
      syncFallback?.();
    });
    return () => {
      active = false;
      observer?.disconnect();
      visibilityTrigger?.kill();
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pagehide', pagehide);
      scene?.dispose();
      scene = null;
      section.classList.remove('has-3d');
    };
  });

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.set(xsecEl, { opacity: 0, scale: 0.7, transformOrigin: '50% 50%' });
    const updateSvg = (P: number) => {
      scope.set(clamp01(P / 0.52));
      scope.beams(clamp01((P - 0.5) / 0.08));
      const zoom = clamp01((P - 0.62) / 0.12);
      const labelFade = 1 - clamp01(zoom / 0.35);
      const draw = clamp01(P / 0.52);
      labelEls.forEach((el) => {
        const at = parseFloat(el.dataset.at || '0');
        el.style.opacity = String(clamp01((draw - at) / 0.04) * labelFade);
      });
      scopeEl.style.transformOrigin = '50% 71.11%'; // coincidence point 300/600, 512/720
      scopeEl.style.transform = `scale(${1 + zoom * 2.2})`;
      scopeEl.style.opacity = String(1 - clamp01(zoom / 0.75));
      xsecEl.style.transform = `scale(${0.82 + zoom * 0.18})`;
      xsecEl.style.opacity = String(clamp01((zoom - 0.15) / 0.6));
      xsecEl.style.transformOrigin = '46% 55.28%'; // trench impact point 276/600, 398/720
      xsec.set(clamp01((P - 0.7) / 0.3));
    };
    const syncDesktopFallback = () => updateSvg(sceneProgress);
    syncFallback = syncDesktopFallback;
    ScrollTrigger.create({
      trigger: '.research-pin',
      start: 'top top',
      end: '+=340%',
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      refreshPriority: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const P = self.progress;
        sceneProgress = P;
        if (scene) scene.setProgress(P);
        else updateSvg(P);
        // readout
        if (P < 0.5) hudRead.textContent = 'e⁻ · 5 kV';
        else {
          const i = Math.min(4, Math.floor(((P - 0.5) / 0.14) * 5));
          const row = R.fib[i];
          hudRead.textContent = `Ga⁺ · ${row.current} · ${row.size}`;
        }
        setPhase(P < 0.5 ? 0 : P < 0.66 ? 1 : P < 0.9 ? 2 : 3);
      },
    });
    return () => {
      if (syncFallback === syncDesktopFallback) syncFallback = null;
    };
  });

  mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.set(xsecEl, { opacity: 1, scale: 1 });
    ScrollTrigger.create({
      trigger: section.querySelector('.stage-canvas'),
      start: 'top 85%',
      end: () => '+=' + (scene ? canvas.clientHeight : scopeEl.clientHeight) * 0.55,
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        sceneProgress = p < 0.8 ? 0.5 * clamp01(p / 0.8) : 0.5 + 0.08 * clamp01((p - 0.8) / 0.2);
        scene?.setProgress(sceneProgress);
        scope.set(clamp01(p / 0.8));
        scope.beams(clamp01((p - 0.75) / 0.25));
      },
    });
    ScrollTrigger.create({
      trigger: xsecEl,
      start: 'top 85%',
      end: 'center 45%',
      scrub: true,
      onUpdate: (self) => xsec.set(self.progress),
    });
    hudPhase.textContent = R.scope.phases[3];
    hudRead.textContent = `Ga⁺ · ${R.fib[4].current} · ${R.fib[4].size}`;
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    section.querySelector('.research-pin')!.classList.add('static-flow');
    gsap.set(xsecEl, { opacity: 1, scale: 1 });
    scope.set(1);
    scope.beams(1, false);
    xsec.set(1);
    hudPhase.textContent = R.scope.phases[3];
    hudRead.textContent = `Ga⁺ · ${R.fib[4].current} · ${R.fib[4].size}`;
  });

  // process line draw (all contexts)
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.to(section.querySelector('.process-line'), {
      scaleX: 1,
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.process', start: 'top 85%', end: 'top 40%', scrub: true },
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(section.querySelector('.process-line'), { scaleX: 1, scaleY: 1 });
  });
}
