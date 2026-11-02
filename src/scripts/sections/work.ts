import { gsap, ScrollTrigger, SplitText } from '../motion';
import { createTile } from './work-tiles';
import type { SiteContent } from '../../content/site';

export function initWork() {
  const list = document.querySelector<HTMLElement>('.work-list');
  if (!list) return;
  const items = Array.from(list.querySelectorAll<HTMLElement>('.work-item'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const splits = new Map<HTMLElement, SplitText>();
  const section = list.closest<HTMLElement>('#work')!;
  const copy: SiteContent['work']['tileCopy'] = JSON.parse(section.dataset.tileCopy!);
  const tiles = new Map<HTMLElement, { root: HTMLElement; tile: ReturnType<typeof createTile>; visible: boolean }>();
  items.forEach((item) => {
    const root = item.querySelector<HTMLElement>('.w-tile')!;
    const tile = createTile(item.dataset.tile as SiteContent['work']['items'][number]['tile'], root, copy, { reduced });
    tiles.set(item, { root, tile, visible: false });
  });
  let introDone = reduced;
  const syncTile = (item: HTMLElement) => {
    const entry = tiles.get(item)!;
    if (reduced) return;
    if (introDone && entry.visible && item.hasAttribute('data-open')) entry.tile.start();
    else entry.tile.stop();
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const item = entry.target.closest<HTMLElement>('.work-item')!;
      tiles.get(item)!.visible = entry.isIntersecting;
      syncTile(item);
    });
  });
  tiles.forEach(({ root, tile }) => {
    if (reduced) tile.finish();
    else observer.observe(root);
  });

  const setHeights = () => {
    items.forEach((item) => {
      const body = item.querySelector<HTMLElement>('.work-body')!;
      body.hidden = !item.hasAttribute('data-open');
      body.style.height = item.hasAttribute('data-open') ? 'auto' : '0px';
    });
  };
  setHeights();

  if (!reduced) {
    const intro = gsap.timeline({
      scrollTrigger: { trigger: list, start: 'top 88%' },
      onComplete: () => { introDone = true; items.forEach(syncTile); },
    });
    intro.from(list.querySelectorAll('.work-line'), { scaleX: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0)
      .from(list.querySelectorAll('.work-row'), { y: 20, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, 0)
      .from(list.querySelectorAll('.w-stage-segment.is-filled'), { scaleX: 0, duration: .5, ease: 'expo.out', stagger: .06 }, 0);
    const score = section.querySelector<HTMLElement>('.work-score')!;
    score.querySelectorAll<HTMLElement>('.work-score-value').forEach((el) => {
      const match = el.dataset.value!.match(/^(\d+)(.*)$/)!;
      const value = { current: 0 }, target = Number(match[1]), padding = match[1].length, suffix = match[2];
      gsap.to(value, {
        current: target, duration: 1.6, ease: 'expo.out',
        scrollTrigger: { trigger: score, start: 'top 85%', once: true },
        onUpdate: () => { el.textContent = `${Math.round(value.current).toString().padStart(padding, '0')}${suffix}`; },
      });
    });
  }

  const revealContent = (item: HTMLElement) => {
    splits.get(item)?.revert();
    const desc = item.querySelector<HTMLElement>('.w-desc')!;
    const split = new SplitText(desc, { type: 'lines', mask: 'lines' });
    splits.set(item, split);
    gsap.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06 });
    gsap.fromTo(item.querySelectorAll('.w-side > *'), { y: 16, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06, delay: 0.15,
    });
    gsap.fromTo(item.querySelector<HTMLElement>('.w-tile')!, { clipPath: 'inset(0 0 100% 0)' }, {
      clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'expo.out', delay: 0.1, overwrite: true,
    });
    gsap.fromTo(item.querySelector<HTMLElement>('.w-tile-inner')!, { scale: 1.15 }, {
      scale: 1, duration: 0.9, ease: 'expo.out', delay: 0.1, overwrite: true,
    });
  };

  const toggle = (item: HTMLElement) => {
    const isOpen = item.hasAttribute('data-open');
    items.forEach((other) => {
      const body = other.querySelector<HTMLElement>('.work-body')!;
      const btn = other.querySelector('button')!;
      if (other === item) {
        gsap.killTweensOf(body);
        if (isOpen) {
          other.removeAttribute('data-open');
          btn.setAttribute('aria-expanded', 'false');
          if (reduced) { body.hidden = true; body.style.height = '0px'; }
          else gsap.to(body, { height: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => { body.hidden = true; ScrollTrigger.refresh(); } });
        } else {
          other.setAttribute('data-open', '');
          btn.setAttribute('aria-expanded', 'true');
          body.hidden = false;
          if (reduced) body.style.height = 'auto';
          else {
            revealContent(other);
            gsap.to(body, {
            height: () => body.scrollHeight,
            duration: 0.7,
            ease: 'expo.inOut',
            onComplete: () => { body.style.height = 'auto'; ScrollTrigger.refresh(); },
            });
          }
        }
      } else if (other.hasAttribute('data-open')) {
        gsap.killTweensOf(body);
        other.removeAttribute('data-open');
        btn.setAttribute('aria-expanded', 'false');
        if (reduced) { body.hidden = true; body.style.height = '0px'; }
        else gsap.to(body, { height: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => { body.hidden = true; ScrollTrigger.refresh(); } });
      }
      syncTile(other);
    });
    if (reduced) ScrollTrigger.refresh();
  };

  items.forEach((item) => {
    item.querySelector('button')!.addEventListener('click', () => toggle(item));
  });

  const preview = document.querySelector<HTMLElement>('.work-preview');
  if (!preview || reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const slides = [...preview.querySelectorAll<HTMLElement>('.wp-slide')];
  const xTo = gsap.quickTo(preview, 'x', { duration: 0.5, ease: 'power3.out' });
  const yTo = gsap.quickTo(preview, 'y', { duration: 0.5, ease: 'power3.out' });
  gsap.set(slides, { yPercent: 100 });
  gsap.set(slides[0], { yPercent: 0 });
  let active = slides[0], shown = false, lastX = 0, lastTime = 0;
  const position = (event: PointerEvent) => ({
    x: Math.min(window.innerWidth - preview.offsetWidth - 8, event.clientX + 24),
    y: Math.min(window.innerHeight - preview.offsetHeight - 8, event.clientY + 24),
  });
  items.forEach((item) => {
    item.querySelector<HTMLElement>('.work-row')!.addEventListener('pointerenter', (event) => {
      const next = slides.find((slide) => slide.dataset.tile === item.dataset.tile)!;
      if (next !== active) {
        const old = active;
        gsap.set(old, { zIndex: 1 });
        gsap.set(next, { zIndex: 2 });
        gsap.to(old, { yPercent: -100, duration: 0.5, ease: 'expo.out', overwrite: true });
        gsap.fromTo(next, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'expo.out', overwrite: true });
        active = next;
      }
      if (!shown) {
        gsap.set(preview, position(event));
        lastX = event.clientX;
        lastTime = event.timeStamp;
      }
      shown = true;
      gsap.to(preview, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out', overwrite: 'auto' });
    });
  });
  list.addEventListener('pointermove', (event) => {
    if (!shown) return;
    const { x, y } = position(event);
    xTo(x);
    yTo(y);
    const dt = Math.max(1, event.timeStamp - lastTime);
    const vx = (event.clientX - lastX) * 1000 / dt;
    lastX = event.clientX;
    lastTime = event.timeStamp;
    gsap.to(preview, { rotation: gsap.utils.clamp(-8, 8, vx * 0.03), duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  });
  list.addEventListener('pointerleave', () => {
    shown = false;
    gsap.to(preview, { scale: 0, opacity: 0, rotation: 0, duration: 0.45, ease: 'expo.out', overwrite: 'auto' });
  });
}
