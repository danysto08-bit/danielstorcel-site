import { gsap } from '../motion';

export function initExperience() {
  const timeline = document.querySelector<HTMLElement>('.xp-timeline');
  if (!timeline) return;
  const rail = timeline.querySelector<HTMLElement>('.xp-rail')!;
  const fill = timeline.querySelector<HTMLElement>('.xp-rail-fill')!;
  const columns = [...timeline.querySelectorAll<HTMLElement>('.xp-column')];
  const nodes = columns.map((column) => column.querySelector<HTMLElement>('.xp-node')!);
  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.fromTo(rail, { scaleX: 0 }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: timeline, start: 'top 85%', end: 'top 45%', scrub: true },
    });
    gsap.from(nodes, {
      scale: 0, duration: 0.55, ease: 'back.out(2)', stagger: 0.1,
      scrollTrigger: { trigger: timeline, start: 'top 85%', end: 'top 45%', scrub: true },
    });
    gsap.from(columns, {
      y: 20, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: timeline, start: 'top 85%' },
      onComplete: () => gsap.set(columns, { clearProps: 'transform,opacity' }),
    });
    const events = new AbortController();
    let hovered: number | null = null;
    let focused: number | null = null;
    const update = () => {
      const index = hovered ?? focused;
      const bounds = timeline.getBoundingClientRect();
      const node = index === null ? null : nodes[index].getBoundingClientRect();
      const progress = node ? (node.left + node.width / 2 - bounds.left) / bounds.width : 0;
      gsap.to(fill, { scaleX: gsap.utils.clamp(0, 1, progress), duration: 0.5, ease: 'expo.out', overwrite: true });
    };
    columns.forEach((column, index) => {
      column.addEventListener('pointerenter', () => { hovered = index; update(); }, { signal: events.signal });
      column.addEventListener('pointerleave', () => { hovered = null; update(); }, { signal: events.signal });
      column.addEventListener('focusin', () => { focused = index; update(); }, { signal: events.signal });
      column.addEventListener('focusout', () => { focused = null; update(); }, { signal: events.signal });
    });
    return () => events.abort();
  });
}
