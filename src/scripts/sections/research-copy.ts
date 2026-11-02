import { gsap } from '../motion';

export function initResearchCopy() {
  const card = document.querySelector<HTMLElement>('.spec-card');
  const pin = document.querySelector<HTMLElement>('.research-pin');
  if (!card || !pin) return;
  const mm = gsap.matchMedia();
  const reveal = (trigger: HTMLElement, start: string) => {
    gsap.timeline({ scrollTrigger: { trigger, start, once: true } })
      .from(card.querySelectorAll('.spec-line'), { scaleX: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 }, 0)
      .from(card.querySelectorAll('.spec-row'), { opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06 }, 0);
  };
  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => reveal(pin, 'top top'));
  mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => reveal(card, 'top 85%'));
}
