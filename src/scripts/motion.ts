import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const EASE = 'expo.out';
export const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

export function initMotion() {
  const isReduced = reduced();
  if (!isReduced) {
    lenis = new Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  return { lenis, isReduced };
}

export function getLenis() {
  return lenis;
}

export { gsap, ScrollTrigger, SplitText };
