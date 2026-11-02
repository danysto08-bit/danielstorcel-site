import { gsap } from '../motion';

export function createDigitRoll(
  roll: HTMLElement,
  options: {
    initial: string;
    reduced: boolean;
    format?: (value: string) => string;
    label?: (value: string) => string;
    accessible: HTMLElement;
  },
) {
  const [first, second] = [...roll.children] as HTMLElement[];
  const format = options.format || ((value: string) => value);
  const label = options.label || format;
  let current = options.initial;
  return (next: string) => {
    if (next === current) return;
    gsap.killTweensOf(roll);
    first.textContent = format(current);
    second.textContent = format(next);
    current = next;
    options.accessible.setAttribute('aria-label', label(next));
    gsap.set(roll, { yPercent: 0 });
    if (options.reduced) first.textContent = format(next);
    else gsap.to(roll, {
      yPercent: -50, duration: 0.45, ease: 'expo.out',
      onComplete: () => { first.textContent = format(next); gsap.set(roll, { yPercent: 0 }); },
    });
  };
}
