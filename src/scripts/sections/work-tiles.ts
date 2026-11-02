import { gsap } from '../motion';
import { decodeDem } from '../dem';
import gerlachUrl from '../../assets/dem/gerlach.png?url';
import metadata from '../../assets/dem/dem.json';
import type { SiteContent } from '../../content/site';

type Item = SiteContent['work']['items'][number];
type Copy = SiteContent['work']['tileCopy'];
type Tile = { start(): void; stop(): void; finish(): void };
type Point = { x: number; y: number };

const cities: [number, number][] = [
  [38.72, -9.14], [40.42, -3.70], [41.39, 2.17], [48.86, 2.35], [45.76, 4.84],
  [50.85, 4.35], [52.37, 4.90], [51.51, -.13], [53.35, -6.26], [55.95, -3.19],
  [59.91, 10.75], [59.33, 18.07], [55.68, 12.57], [60.17, 24.94], [59.44, 24.75],
  [56.95, 24.11], [54.69, 25.28], [52.23, 21.01], [50.06, 19.94], [52.52, 13.40],
  [48.14, 11.58], [53.55, 9.99], [50.08, 14.44], [49.20, 16.61], [48.15, 17.11],
  [48.21, 16.37], [47.27, 11.39], [47.50, 19.04], [46.06, 14.51], [45.81, 15.98],
  [44.79, 20.46], [44.43, 26.10], [42.70, 23.32], [37.98, 23.73], [41.90, 12.50],
  [45.46, 9.19], [47.38, 8.54], [45.92, 6.87],
];

function createCanvas(root: HTMLElement, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas');
  root.append(canvas);
  const ctx = canvas.getContext('2d')!;
  let w = 0, h = 0;
  const redraw = () => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    w = rect.width;
    h = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, h);
  };
  new ResizeObserver(redraw).observe(root);
  return { draw: () => { if (w && h) draw(ctx, w, h); }, resize: redraw };
}

function curved(points: Point[], samples = 120): Point[] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples * (points.length - 1), k = Math.min(points.length - 2, Math.floor(t)), f = t - k;
    const a = points[Math.max(0, k - 1)], b = points[k], c = points[k + 1], d = points[Math.min(points.length - 1, k + 2)];
    const blend = (p0: number, p1: number, p2: number, p3: number) =>
      .5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    return { x: blend(a.x, b.x, c.x, d.x), y: blend(a.y, b.y, c.y, d.y) };
  });
}

type Contour = { level: number; path: Path2D };
let terrainCache: Promise<{ contours: Contour[]; route: Point[] }> | undefined;
function terrainData() {
  if (terrainCache) return terrainCache;
  terrainCache = decodeDem(gerlachUrl).then((data) => {
    const contours: Contour[] = [];
    const min = Math.floor(Math.min(...data) / 100) * 100;
    const max = Math.ceil(Math.max(...data) / 100) * 100;
    for (let level = min; level <= max; level += 100) {
      const path = new Path2D();
      for (let y = 0; y < 255; y++) for (let x = 0; x < 255; x++) {
        const values = [data[y * 256 + x], data[y * 256 + x + 1], data[(y + 1) * 256 + x + 1], data[(y + 1) * 256 + x]];
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const hits: Point[] = [];
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          if ((values[i] < level) === (values[j] < level)) continue;
          const t = (level - values[i]) / (values[j] - values[i]);
          hits.push({ x: (corners[i][0] + (corners[j][0] - corners[i][0]) * t) / 255, y: (corners[i][1] + (corners[j][1] - corners[i][1]) * t) / 255 });
        }
        for (let i = 0; i + 1 < hits.length; i += 2) {
          path.moveTo(hits[i].x, hits[i].y);
          path.lineTo(hits[i + 1].x, hits[i + 1].y);
        }
      }
      contours.push({ level, path });
    }
    const summit = metadata.find((peak) => peak.id === 'gerlach')!.summit;
    const points: Point[] = [{ x: .33, y: .97 }];
    let lastX = 84;
    for (let i = 1; i < 14; i++) {
      const y = Math.round(247 + (summit.row - 247) * i / 14);
      const targetX = 84 + (summit.col - 84) * i / 14;
      let bestX = lastX, best = -Infinity;
      for (let x = Math.max(1, lastX - 9); x <= Math.min(254, lastX + 9); x++) {
        const score = data[y * 256 + x] - Math.abs(x - targetX) * 8;
        if (score > best) { best = score; bestX = x; }
      }
      lastX = bestX;
      points.push({ x: bestX / 255, y: y / 255 });
    }
    points.push({ x: summit.col / 255, y: summit.row / 255 });
    return { contours, route: curved(points) };
  });
  return terrainCache;
}

export function createTile(kind: Item['tile'], root: HTMLElement, copy: Copy, options: { reduced: boolean }): Tile {
  const inner = root.querySelector<HTMLElement>('.w-tile-inner')!;
  let timeline: gsap.core.Timeline | undefined;
  let running = false;
  let make: () => gsap.core.Timeline;
  let setFinal: () => void;
  let resize: (() => void) | undefined;
  const palette = { fg: '', accent: '' };
  const readPalette = () => {
    const style = getComputedStyle(document.body);
    palette.fg = style.getPropertyValue('--fg').trim();
    palette.accent = style.getPropertyValue('--accent').trim();
  };
  readPalette();

  if (kind === 'carbontrail') {
    const path = inner.querySelector<SVGPathElement>('.carbon-trail path')!;
    const b = inner.querySelector<HTMLElement>('.carbon-cell.is-b')!;
    const length = path.getTotalLength();
    make = () => gsap.timeline({ repeat: -1, repeatDelay: 2.5 })
      .fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out' })
      .set(path, { strokeDasharray: '5 4' })
      .fromTo(b, { scale: .65, opacity: .3 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2)' }, '-=.2')
      .to(path, { opacity: .3, duration: .35 }, '+=2.5')
      .set(path, { opacity: 1 });
    setFinal = () => { gsap.set(path, { strokeDasharray: '5 4', strokeDashoffset: 0, opacity: 1 }); gsap.set(b, { scale: 1, opacity: 1 }); };
  } else if (kind === 'aimtoru') {
    const layout = document.createElement('div');
    layout.className = 'aim-layout';
    const record = document.createElement('div');
    record.className = 'aim-record';
    record.innerHTML = '<div class="aim-heading">PATIENT RECORD</div>';
    const tokens = ['Allergien: Penicillin', 'Eliquis 5 mg', 'eGFR 52 ml/min'];
    for (let i = 0; i < 8; i++) {
      const row = document.createElement('div');
      row.className = 'aim-record-row';
      const bar = document.createElement('i');
      bar.className = 'aim-bar';
      bar.style.width = `${[80, 48, 88, 56, 76, 43, 92, 65][i]}%`;
      if ([1, 4, 6].includes(i)) {
        const token = document.createElement('span');
        token.className = 'aim-token';
        token.textContent = tokens[[1, 4, 6].indexOf(i)];
        bar.style.width = '20%';
        row.append(token, bar);
      } else row.append(bar);
      record.append(row);
    }
    const facts = document.createElement('div');
    facts.className = 'aim-facts';
    const heading = document.createElement('div');
    heading.className = 'aim-heading';
    heading.textContent = copy.aimtoruFacts;
    facts.append(heading);
    for (let i = 0; i < 3; i++) {
      const row = document.createElement('div');
      row.className = 'aim-fact';
      row.innerHTML = '<span class="aim-fact-bars"><i class="aim-bar" style="width:90%"></i><i class="aim-bar" style="width:60%"></i></span>';
      facts.append(row);
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'aim-lines');
    svg.setAttribute('viewBox', '0 0 300 180');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < 3; i++) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.append(path);
    }
    const badge = document.createElement('div');
    badge.className = 'aim-badge';
    badge.textContent = `! ${copy.aimtoruContradiction}`;
    layout.append(record, facts, svg, badge);
    inner.append(layout);
    const bars = layout.querySelectorAll('.aim-bar');
    const factRows = layout.querySelectorAll('.aim-fact');
    const tokenEls = layout.querySelectorAll('.aim-token');
    const paths = [...svg.querySelectorAll('path')];
    const connect = () => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      paths.forEach((path, i) => {
        const token = tokenEls[i].getBoundingClientRect(), fact = factRows[i].getBoundingClientRect();
        const x1 = (fact.left + 2 - rect.left) * 300 / rect.width;
        const y1 = (fact.top + fact.height / 2 - rect.top) * 180 / rect.height;
        const x2 = (token.right + 2 - rect.left) * 300 / rect.width;
        const y2 = (token.bottom - rect.top) * 180 / rect.height;
        const mid = (x1 + x2) / 2;
        path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`);
        gsap.set(path, { strokeDasharray: path.getTotalLength() });
      });
    };
    new ResizeObserver(connect).observe(layout);
    make = () => {
      connect();
      return gsap.timeline({ repeat: -1, repeatDelay: 2.5 })
      .set(layout, { opacity: 1 })
      .fromTo(bars, { scaleX: 0 }, { scaleX: 1, stagger: .05, duration: .35, ease: 'power2.out' })
      .fromTo(factRows, { x: 10, opacity: 0 }, { x: 0, opacity: 1, stagger: .12, duration: .4 }, '-=.25')
      .fromTo(paths, { strokeDashoffset: (i: number) => paths[i].getTotalLength() }, { strokeDashoffset: 0, duration: .5, stagger: .13 })
      .to(tokenEls, { borderBottomColor: palette.accent, stagger: .13, duration: .2 }, '<')
      .fromTo(badge, { rotationX: -90, opacity: 0 }, { rotationX: 0, opacity: 1, duration: .4, ease: 'back.out(1.4)' })
      .to(layout, { opacity: 0, duration: .4 }, '+=2.5');
    };
    setFinal = () => { connect(); gsap.set(layout, { opacity: 1 }); gsap.set(bars, { scaleX: 1 }); gsap.set(factRows, { x: 0, opacity: 1 }); gsap.set(paths, { strokeDashoffset: 0 }); gsap.set(tokenEls, { borderBottomColor: palette.accent }); gsap.set(badge, { rotationX: 0, opacity: 1 }); };
  } else if (kind === 'grynade') {
    const title = document.createElement('div');
    title.className = 'gry-title';
    const [before, after] = copy.grynadeLine.split('LOCKED');
    title.append(document.createTextNode(before));
    const locked = document.createElement('span');
    locked.className = 'gry-locked';
    locked.textContent = 'LOCKED';
    title.append(locked, document.createTextNode(after));
    const count = document.createElement('div');
    count.className = 'gry-count';
    const photo = inner.querySelector<HTMLElement>('.gry-photo')!;
    inner.append(title, count);
    const number = { value: 0 };
    const update = () => { count.textContent = `${Math.round(number.value).toLocaleString('en-US').replace(/,/g, ' ')} ${copy.grynadeLikes}`; };
    make = () => gsap.timeline({ repeat: -1, repeatDelay: 2.5 })
      .fromTo(number, { value: 0 }, { value: 10000, duration: 1.8, ease: 'expo.out', onUpdate: update }, 0)
      .fromTo(photo, { scale: 1 }, { scale: 1.06, duration: 8, ease: 'none' }, 0);
    setFinal = () => { number.value = 10000; update(); gsap.set(photo, { scale: 1 }); };
  } else if (kind === 'taro') {
    const state = { dots: 0, lines: 0, glyph: 0, caption: 0, alpha: 1 };
    const target = { x: (20.13 + 10) / 38, y: (62 - 49.17) / 26 };
    const origins = [0, 3, 7, 10, 13, 17, 23, 27, 34];
    const screen = (p: Point, w: number, h: number) => ({ x: 20 + p.x * (w - 40), y: 16 + p.y * (h - 44) });
    const map = ([lat, lon]: [number, number]) => ({ x: (lon + 10) / 38, y: (62 - lat) / 26 });
    const mapped = cities.map(map);
    const edgeKeys = new Set<string>();
    mapped.forEach((point, i) => {
      mapped.map((other, j) => ({ j, distance: (point.x - other.x) ** 2 + (point.y - other.y) ** 2 }))
        .filter(({ j }) => i !== j).sort((a, b) => a.distance - b.distance).slice(0, 2)
        .forEach(({ j }) => edgeKeys.add([Math.min(i, j), Math.max(i, j)].join(',')));
    });
    const edges = [...edgeKeys].map((key) => key.split(',').map(Number));
    const canvas = createCanvas(inner, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = palette.fg; ctx.lineWidth = 1;
      edges.forEach(([a, b]) => {
        const opacity = Math.max(0, Math.min(1, state.dots - Math.max(a, b)));
        if (!opacity) return;
        const start = screen(mapped[a], w, h), end = screen(mapped[b], w, h);
        ctx.globalAlpha = state.alpha * opacity * .12;
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      });
      mapped.forEach((city, i) => {
        const p = screen(city, w, h);
        const alpha = Math.max(0, Math.min(1, state.dots - i));
        ctx.globalAlpha = state.alpha * alpha;
        ctx.fillStyle = i % 5 === 0 ? palette.accent : palette.fg;
        ctx.beginPath(); ctx.arc(p.x, p.y, (i % 5 === 0 ? 2.4 : 2) * alpha, 0, Math.PI * 2); ctx.fill();
      });
      const end = screen(target, w, h);
      origins.forEach((origin, i) => {
        const progress = Math.max(0, Math.min(1, state.lines - i));
        if (!progress) return;
        const start = screen(mapped[origin], w, h);
        const x = start.x + (end.x - start.x) * progress, y = start.y + (end.y - start.y) * progress;
        ctx.globalAlpha = state.alpha * .6; ctx.strokeStyle = palette.accent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = state.alpha; ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = state.alpha;
      ctx.beginPath(); ctx.moveTo(end.x - 11, end.y + 5); ctx.lineTo(end.x - 4, end.y - 7); ctx.lineTo(end.x, end.y - 1); ctx.lineTo(end.x + 4, end.y - 10); ctx.lineTo(end.x + 12, end.y + 5); ctx.closePath();
      ctx.strokeStyle = palette.accent; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = state.alpha * state.glyph; ctx.fillStyle = palette.accent; ctx.fill();
      ctx.globalAlpha = state.alpha; ctx.beginPath(); ctx.moveTo(end.x, end.y - 1); ctx.lineTo(end.x + 3, end.y + 5); ctx.stroke();
      ctx.globalAlpha = state.alpha; ctx.fillStyle = palette.fg; ctx.font = '10px monospace';
      ctx.fillText(copy.taroCaption.slice(0, Math.floor(state.caption)), 16, h - 12);
      ctx.globalAlpha = 1;
    });
    resize = canvas.resize;
    make = () => gsap.timeline({ repeat: -1, repeatDelay: 2.5, onUpdate: canvas.draw })
      .set(state, { dots: 0, lines: 0, glyph: 0, caption: 0, alpha: 1 })
      .to(state, { dots: cities.length + 1, duration: cities.length * .03, ease: 'none' })
      .to(state, { lines: origins.length + 1, duration: 2, ease: 'none' })
      .to(state, { glyph: 1, duration: .35 })
      .to(state, { caption: copy.taroCaption.length, duration: 1, ease: 'none' })
      .to(state, { alpha: 0, duration: .4 }, '+=2.5');
    setFinal = () => { Object.assign(state, { dots: cities.length + 1, lines: origins.length + 1, glyph: 1, caption: copy.taroCaption.length, alpha: 1 }); canvas.resize(); };
  } else {
    const state = { contours: 0, route: 0, tags: 0, alpha: 1 };
    let data: Awaited<ReturnType<typeof terrainData>> | undefined;
    const canvas = createCanvas(inner, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (!data) return;
      const summit = metadata.find((peak) => peak.id === 'gerlach')!.summit;
      const size = w / .6, left = w / 2 - summit.col / 255 * size, top = h / 2 - summit.row / 255 * size;
      ctx.save(); ctx.translate(left, top); ctx.scale(size, size);
      ctx.lineWidth = 1 / size;
      data.contours.forEach(({ level, path }, i) => {
        const opacity = Math.max(0, Math.min(1, state.contours * data!.contours.length - i));
        ctx.globalAlpha = opacity * state.alpha * (level % 500 === 0 ? .75 : .3);
        ctx.strokeStyle = palette.fg;
        ctx.stroke(path);
      });
      const first = Math.max(0, data.route.findIndex((point) => top + point.y * size <= h - 18));
      const points = data.route.slice(Math.max(0, first - 1));
      const end = Math.max(0, Math.min(points.length - 1, Math.floor(state.route * (points.length - 1))));
      if (end > 0) {
        ctx.globalAlpha = state.alpha; ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.5 / size; ctx.setLineDash([4 / size, 3 / size]);
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= end; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(points[end].x, points[end].y, 3 / size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      [.3, .6, .9].forEach((at, i) => {
        if (state.tags <= i) return;
        const p = points[Math.round(at * (points.length - 1))], x = left + p.x * size, y = top + p.y * size;
        ctx.globalAlpha = Math.min(1, state.tags - i) * state.alpha;
        const right = x < w * .55, tx = x + (right ? 22 : -22);
        ctx.strokeStyle = palette.fg; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, y - 8); ctx.stroke();
        ctx.font = '9px monospace'; ctx.textAlign = right ? 'left' : 'right';
        const textX = tx + (right ? 3 : -3), textWidth = ctx.measureText(copy.mountainsTags[i]).width;
        ctx.fillStyle = 'rgba(5,5,6,.75)';
        ctx.fillRect((right ? textX : textX - textWidth) - 1, y - 20, textWidth + 2, 11);
        ctx.fillStyle = palette.fg; ctx.fillText(copy.mountainsTags[i], textX, y - 10);
      });
      ctx.globalAlpha = 1; ctx.textAlign = 'start';
    });
    const load = () => { terrainData().then((result) => { data = result; canvas.resize(); }).catch((error) => console.warn('Work DEM unavailable:', error)); };
    resize = () => { canvas.resize(); if (!data) load(); };
    make = () => gsap.timeline({ repeat: -1, repeatDelay: 2.5, onUpdate: canvas.draw })
      .set(state, { contours: 0, route: 0, tags: 0, alpha: 1 })
      .to(state, { contours: 1, duration: 2.4, ease: 'none' })
      .to(state, { route: 1, duration: 1.8, ease: 'none' })
      .to(state, { tags: 3, duration: .9, ease: 'none' })
      .to(state, { alpha: 0, duration: .4 }, '+=2.5');
    setFinal = () => { Object.assign(state, { contours: 1, route: 1, tags: 3, alpha: 1 }); resize?.(); };
  }

  const stop = () => {
    running = false;
    root.dataset.running = '0';
    timeline?.kill();
    timeline = undefined;
  };
  return {
    start() {
      if (options.reduced) { this.finish(); return; }
      if (running) return;
      readPalette();
      running = true;
      root.dataset.running = '1';
      resize?.();
      timeline = make();
    },
    stop,
    finish() { stop(); readPalette(); setFinal(); },
  };
}
