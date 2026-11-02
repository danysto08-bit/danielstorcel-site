import { gsap, ScrollTrigger } from '../motion';
import type { TerrainAPI } from './terrain';
import { stateAt } from './summit-state';

const NODE_FRACTIONS = [0.22, 0.5, 0.96];
function parsePace(v: string): { total: number; format: (s: number) => string } {
  const m = v.match(/(\d+):(\d+)/)!;
  const total = parseInt(m[1]) * 60 + parseInt(m[2]);
  const suffix = v.endsWith('/km') ? '/km' : '';
  return {
    total,
    format: (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}${suffix}`,
  };
}

export function initSummit() {
  const section = document.querySelector<HTMLElement>('#summit');
  if (!section) return;
  const stage = section.querySelector<HTMLElement>('.summit-stage')!;
  const canvas = section.querySelector<HTMLCanvasElement>('#terrainCanvas')!;
  const path = section.querySelector<SVGPathElement>('#ridgeMain')!;
  const back = section.querySelector<SVGPathElement>('#ridgeBack')!;
  const svg = section.querySelector<SVGSVGElement>('#ridgeSvg')!;
  const nodes = Array.from(section.querySelectorAll<HTMLElement>('.peak-node'));
  const readout = section.querySelector<HTMLElement>('#altReadout')!;
  const photos = Array.from(section.querySelectorAll<HTMLElement>('.stack-photo'));
  const emptyFrame = section.querySelector<HTMLElement>('.stack-empty')!;
  const stack = section.querySelector<HTMLElement>('.photo-stack')!;
  const hud = section.querySelector<HTMLElement>('.hud-details')!;
  const hudChapters = Array.from(section.querySelectorAll<HTMLElement>('.hud-chapter'));
  const hudRoute = section.querySelector<HTMLElement>('.hud-route')!;
  const tether = section.querySelector<SVGSVGElement>('.summit-tether')!;
  const tetherLine = tether.querySelector('line')!;
  const tetherDot = tether.querySelector('circle')!;
  const hutLabels = Array.from(section.querySelectorAll<HTMLElement>('.hut-label'));
  const context = section.querySelector<HTMLElement>('.stage-context')!;

  let terrain: TerrainAPI | null = null;
  let currentProgress = 0;
  let hudChapter = -1, cardShown = true;

  function updateState(p: number, animate = true) {
    currentProgress = p;
    const state = stateAt(p);
    terrain?.setProgress(p);
    readout.textContent = String(Math.round(state.altitude));
    stage.style.setProperty('--sky-glow', String(state.glow));
    hudRoute.style.opacity = state.chapter === 2 && state.route > 0 ? '1' : '0';
    if (hudChapter !== state.chapter) {
      hudChapter = state.chapter;
      const swap = () => {
        hudChapters.forEach((el, i) => el.toggleAttribute('data-active', i === hudChapter));
        gsap.to(hud, { opacity: 1, duration: animate ? .125 : 0, overwrite: true });
      };
      if (animate) gsap.to(hud, { opacity: 0, duration: .125, overwrite: true, onComplete: swap });
      else swap();
    }
    stack.dataset.chapter = String(state.chapter);
    const photo = state.chapter === 0 ? 0 : state.chapter === 1 ? 1 + Math.min(2, Math.floor(state.chapterT * 3)) : -1;
    photos.forEach((el, i) => el.toggleAttribute('data-active', i === photo));
    emptyFrame.toggleAttribute('data-active', photo === -1);
    const show = !((p > .34 && p < .42) || (p > .66 && p < .74));
    if (show !== cardShown && window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)').matches) {
      cardShown = show;
      gsap.to(stack, { opacity: show ? 1 : 0, scale: show ? 1 : .96, duration: .5, ease: 'power2.out', overwrite: true });
    }
  }

  async function setup3D(reduced: boolean): Promise<boolean> {
    try {
      const { createTerrain } = await import('./terrain');
      const t = await createTerrain(canvas, { reduced, mobile: window.matchMedia('(max-width: 1023px)').matches });
      if (!t) return false;
      terrain = t;
      terrain.setProgress(currentProgress);
      section!.classList.add('has-3d');
      const host = canvas.parentElement as HTMLElement;
      nodes.forEach((n) => host.appendChild(n));
      const routePoints = terrain.routePoints();
      let staticProjected = false;
      const updateProjection = () => {
        if (!terrain) return;
        const state = stateAt(currentProgress);
        nodes.forEach((node, i) => {
          const p = terrain!.project(i);
          node.style.left = `${p.x}px`;
          node.style.top = `${p.y}px`;
          node.style.visibility = p.visible && currentProgress >= .13 && p.weight > 0 ? '' : 'hidden';
          node.style.opacity = state.chapter >= i ? String(p.weight) : '0';
          node.classList.toggle('edge', p.x > host.clientWidth * 0.7);
        });
        const peak = terrain.project(state.chapter);
        const card = state.chapter === 2 ? emptyFrame : photos.find((el) => el.hasAttribute('data-active'));
        const morphing = (currentProgress > .34 && currentProgress < .42) || (currentProgress > .66 && currentProgress < .74);
        const visible = peak.visible && peak.weight > 0 && currentProgress >= .13 && !morphing && !!card;
        tether.style.visibility = visible ? 'visible' : 'hidden';
        tether.classList.toggle('goal', state.chapter === 2);
        if (visible && card) {
          const hostRect = host.getBoundingClientRect(), cardRect = card.getBoundingClientRect();
          tetherLine.setAttribute('x1', String(cardRect.left - hostRect.left));
          tetherLine.setAttribute('y1', String(cardRect.bottom - hostRect.top));
          tetherLine.setAttribute('x2', String(peak.x));
          tetherLine.setAttribute('y2', String(peak.y));
          tetherDot.setAttribute('cx', String(peak.x));
          tetherDot.setAttribute('cy', String(peak.y));
        }
        const hudRect = section!.querySelector<HTMLElement>('.summit-hud')!.getBoundingClientRect();
        const candidates: boolean[] = [];
        hutLabels.forEach((label, i) => {
          const point = terrain!.projectPoint(routePoints[i]);
          label.style.left = `${point.x}px`;
          label.style.top = `${point.y + (i % 2 ? -14 : 14)}px`;
          label.classList.toggle('edge', point.x > host.clientWidth * .7);
          candidates.push(state.chapter === 2 && state.route > 0 && state.route >= i / 5 && point.visible);
        });
        hutLabels.forEach((label, i) => {
          const box = label.getBoundingClientRect();
          const overlapsHud = box.left < hudRect.right + 24 && box.right > hudRect.left - 24 &&
            box.top < hudRect.bottom + 24 && box.bottom > hudRect.top - 24;
          const shown = candidates[i] && !overlapsHud;
          label.style.visibility = shown ? 'visible' : 'hidden';
          label.style.opacity = shown ? '1' : '0';
        });
      };
      new ResizeObserver(() => {
        terrain?.resize();
        if (reduced && staticProjected) updateProjection();
      }).observe(host);
      if (reduced) {
        setTimeout(() => { updateProjection(); staticProjected = true; }, 250);
      } else gsap.ticker.add(updateProjection);
      window.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        terrain?.setPointer(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          ((e.clientY - r.top) / r.height) * 2 - 1
        );
      });
      window.addEventListener('pagehide', () => terrain?.dispose(), { once: true });
      const visibility = ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? terrain?.start() : terrain?.stop()),
      });
      if (visibility.isActive) terrain.start();
      return true;
    } catch {
      return false;
    }
  }

  function defer3D(reduced: boolean, onReady?: (ok: boolean) => void) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void setup3D(reduced).then(onReady);
    }, { rootMargin: '50% 0px' });
    observer.observe(section!);
    return () => observer.disconnect();
  }

  // SVG fallback node placement
  const placeNodes = () => {
    if (terrain) return;
    const len = path.getTotalLength();
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const r = svg.parentElement!.getBoundingClientRect();
    nodes.forEach((node, i) => {
      const pt = path.getPointAtLength(len * NODE_FRACTIONS[i]);
      const screen = new DOMPoint(pt.x, pt.y).matrixTransform(matrix);
      const x = screen.x - r.left, y = screen.y - r.top;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.classList.toggle('edge', x > r.width * .7);
    });
  };

  const lightNodes = (p: number) => {
    const { chapter } = stateAt(p);
    nodes.forEach((node, i) => {
      const lit = chapter >= i && p >= .13;
      if (terrain) { node.classList.toggle('lit', lit); return; }
      if (lit && !node.classList.contains('lit')) {
        node.classList.add('lit');
        gsap.to(node, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' });
        gsap.fromTo(node.querySelector('.pk-dot'), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      } else if (!lit && node.classList.contains('lit')) {
        node.classList.remove('lit');
        gsap.set(node, { opacity: 0 });
      }
    });
  };

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    const cancelLoad = defer3D(false);
    const len = path.getTotalLength();
    const backLen = back.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set(back, { strokeDasharray: backLen, strokeDashoffset: backLen });
    gsap.set(nodes, { opacity: 0, scale: 0.8 });
    updateState(0, false);

    ScrollTrigger.create({
      trigger: '.summit-stage',
      start: 'top top',
      end: '+=380%',
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      refreshPriority: 1,
      invalidateOnRefresh: true,
      onRefresh: placeNodes,
      onUpdate: (self) => {
        const p = self.progress;
        updateState(p);
        if (!terrain) {
          path.style.strokeDashoffset = String(len * (1 - p));
          back.style.strokeDashoffset = String(backLen * (1 - p));
        }
        lightNodes(p);
        const ctxFade = Math.min(1, Math.max(0, (p - 0.08) / 0.07));
        context.style.opacity = String(1 - ctxFade);
        context.style.transform = `translateY(${-24 * ctxFade}px)`;
      },
    });
    placeNodes();
    return cancelLoad;
  });

  mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
    updateState(0, false);
    const cancelLoad = defer3D(false);
    gsap.set([path, back], { strokeDashoffset: 0 });
    gsap.set(nodes, { opacity: 1 });
    ScrollTrigger.create({
      trigger: stage, start: 'top 85%', end: 'bottom 15%', scrub: true,
      onUpdate: (self) => updateState(self.progress, false),
    });
    placeNodes();
    return cancelLoad;
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    stage.classList.add('static-stage');
    updateState(1, false);
    const cancelLoad = defer3D(true, (ok) => {
      if (ok && terrain) {
        terrain.start();
        setTimeout(() => terrain?.stop(), 2500); // settle to the static pose
      }
    });
    gsap.set([path, back], { strokeDashoffset: 0 });
    gsap.set(nodes, { opacity: 1 });
    context.style.opacity = '1';
    placeNodes();
    return cancelLoad;
  });

  // stat count-ups (all viewports; skip under reduced motion)
  const statNums = section.querySelectorAll<HTMLElement>('.stat-num');
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    statNums.forEach((el) => {
      const { total, format } = parsePace(el.dataset.value!);
      const obj = { s: 0 };
      el.textContent = format(0);
      gsap.to(obj, {
        s: total,
        duration: 1.8,
        ease: 'expo.out',
        onUpdate: () => (el.textContent = format(obj.s)),
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    statNums.forEach((el) => (el.textContent = el.dataset.value!));
  });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.from(section.querySelectorAll('.prep-row'), {
      opacity: 0,
      y: 24,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: '.prep-list', start: 'top 88%' },
    });
  }
}
