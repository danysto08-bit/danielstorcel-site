import { gsap, SplitText } from '../motion';
import { createDigitRoll } from '../ui/digits';

export function initRecord() {
  const section = document.querySelector<HTMLElement>('#record');
  if (!section) return;
  const track = section.querySelector<HTMLElement>('.rec-track')!;
  const fill = section.querySelector<HTMLElement>('.rec-bar-fill')!;
  const counter = section.querySelector<HTMLElement>('.rec-counter')!;
  const panels = [...section.querySelectorAll<HTMLElement>('.rec-panel')];
  const roll = counter.querySelector<HTMLElement>('.rec-counter-roll')!;
  const setCounter = createDigitRoll(roll, {
    initial: '01', reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    accessible: counter, label: (value) => `${value} — ${String(panels.length).padStart(2, '0')}`,
  });

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    const getDist = () => Math.max(0, track.scrollWidth - window.innerWidth + 64);
    let enabled = true;
    const revealed = new Set<HTMLElement>();
    const splits = panels.map((panel) => {
      const split = new SplitText(panel.querySelector('.rec-stat')!, { type: 'chars' });
      gsap.set(split.chars, { yPercent: 110, rotateX: -60, opacity: 0, transformOrigin: '50% 100%' });
      gsap.set(panel.querySelectorAll('.rec-item-title, .rec-desc, .rec-bullets li'), { y: 14, opacity: 0 });
      return split;
    });
    const reveal = (panel: HTMLElement, index: number) => {
      if (revealed.has(panel)) return;
      revealed.add(panel);
      gsap.timeline()
        .to(splits[index].chars, { yPercent: 0, rotateX: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.04 }, 0)
        .to(panel.querySelectorAll('.rec-item-title, .rec-desc'), { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 }, 0.1)
        .to(panel.querySelectorAll('.rec-bullets li'), { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 }, 0.2);
    };
    const updateDepth = (progress: number) => {
      const rect = section.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      panels.forEach((panel, index) => {
        const box = panel.getBoundingClientRect();
        const c = (box.left + box.width / 2 - window.innerWidth / 2) / window.innerWidth;
        const d = gsap.utils.clamp(-1, 1, c * 1.6);
        const amount = Math.abs(d);
        panel.classList.toggle('is-centered', amount < 0.35);
        gsap.set(panel, { rotationY: -d * 9, scale: 1 - amount * 0.06, opacity: 1 - amount * 0.45 });
        gsap.set(panel.querySelector('.rec-panel-text'), { x: d * -24 });
        const ghost = panel.querySelector<HTMLElement>('.rec-ghost');
        if (ghost) gsap.set(ghost, { x: d * 30 });
        const img = panel.querySelector<HTMLImageElement>('.rec-photo img');
        if (img) {
          const p = gsap.utils.clamp(0, 1, progress * panels.length - index);
          gsap.set(img, { x: (p - 0.5) * -24, scale: 1.12 - (1 - amount) * 0.12 });
        }
        if (inView && amount < 0.35) reveal(panel, index);
      });
    };
    let progress = 0;
    const tween = gsap.to(track, {
      x: () => -getDist(),
      ease: 'none',
      onUpdate: () => updateDepth(progress),
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + getDist(),
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        refreshPriority: 1,
        onRefresh: (self) => {
          progress = self.progress;
          requestAnimationFrame(() => { if (enabled) updateDepth(progress); });
        },
        onUpdate: (self) => {
          progress = self.progress;
          fill.style.transform = `scaleX(${self.progress})`;
          const idx = Math.min(panels.length, Math.round(self.progress * (panels.length - 1)) + 1);
          setCounter(String(idx).padStart(2, '0'));
          updateDepth(progress);
        },
      },
    });
    return () => {
      enabled = false;
      tween.kill();
      splits.forEach((split) => split.revert());
      panels.forEach((panel) => panel.classList.remove('is-centered'));
      gsap.set(section.querySelectorAll('.rec-panel, .rec-panel-text, .rec-item-title, .rec-desc, .rec-bullets li, .rec-photo img, .rec-ghost'), { clearProps: 'transform,opacity' });
    };
  });

  mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.set(track, { x: 0 });
    gsap.set(fill, { scaleX: 1 });
    setCounter('01');
    panels.forEach((p) => {
      gsap.from(p, {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: { trigger: p, start: 'top 88%' },
      });
    });
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    section.classList.add('rec-static');
    gsap.set(track, { x: 0 });
    gsap.set(fill, { scaleX: 1 });
    setCounter('01');
  });
}
