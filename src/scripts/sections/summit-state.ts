const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t);

export function stateAt(value: number) {
  const p = clamp(value);
  const morph = p < .34 ? 0 : p < .42 ? smooth((p - .34) / .08)
    : p < .66 ? 1 : p < .74 ? 1 + smooth((p - .66) / .08) : 2;
  const altitude = p < .1 ? mix(0, 400, p / .1)
    : p < .34 ? mix(400, 1691, (p - .1) / .24)
    : p < .42 ? 1691
    : p < .66 ? mix(1691, 2655, (p - .42) / .24)
    : p < .74 ? 2655
    : mix(2655, 4808, (p - .74) / .26);
  const chapter = p < .42 ? 0 : p < .74 ? 1 : 2;
  const chapterT = chapter === 0 ? clamp(p / .34)
    : chapter === 1 ? clamp((p - .42) / .24) : clamp((p - .74) / .26);
  const buildT = clamp(p / .1);
  return {
    p, morph, altitude, chapter, chapterT,
    build: buildT === 1 ? 1 : 1 - 2 ** (-10 * buildT),
    route: clamp((p - .76) / .22),
    glow: clamp((p - .85) / .15),
    snow: clamp((p - .74) / .2),
  };
}
