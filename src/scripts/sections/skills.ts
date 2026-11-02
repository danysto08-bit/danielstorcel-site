import { gsap, ScrollTrigger, getLenis } from '../motion';
import { decodeDem } from '../dem';
import gerlachUrl from '../../assets/dem/gerlach.png?url';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Point = { x: number; y: number };
type Contour = { points: Point[]; distances: number[]; length: number };
type MonogramPose = Point & { angle: number; scale: number };

function traceContours(pixels: Uint8ClampedArray, size: number): Contour[] {
  const boundary = new Uint8Array(size * size);
  const filled = (x: number, y: number) => x >= 0 && x < size && y >= 0 && y < size && pixels[(y * size + x) * 4 + 3] > 128;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (filled(x, y) && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1))) boundary[y * size + x] = 1;
  }
  const contours: Contour[] = [];
  for (let start = 0; start < boundary.length; start++) {
    if (!boundary[start]) continue;
    const points: Point[] = [], distances = [0];
    let x = start % size, y = Math.floor(start / size), length = 0;
    while (true) {
      boundary[y * size + x] = 0;
      points.push({ x, y });
      let nextX = -1, nextY = -1, best = 37;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const distance = dx * dx + dy * dy, nx = x + dx, ny = y + dy;
        if (distance && distance <= 36 && distance < best && nx >= 0 && nx < size && ny >= 0 && ny < size && boundary[ny * size + nx]) {
          best = distance; nextX = nx; nextY = ny;
        }
      }
      if (nextX < 0) break;
      length += Math.sqrt(best);
      distances.push(length);
      x = nextX; y = nextY;
    }
    if (length >= 60 && points.length > 1) contours.push({ points, distances, length });
  }
  return contours;
}

function contourPoint(contour: Contour, distance: number): Point {
  const target = Math.max(0, Math.min(contour.length, distance));
  let low = 0, high = contour.distances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (contour.distances[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (!low) return contour.points[0];
  const t = (target - contour.distances[low - 1]) / (contour.distances[low] - contour.distances[low - 1]);
  return { x: mix(contour.points[low - 1].x, contour.points[low].x, t), y: mix(contour.points[low - 1].y, contour.points[low].y, t) };
}

export function initSkills() {
  const section = document.querySelector<HTMLElement>('#skills');
  if (!section) return;
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const stage = section.querySelector<HTMLElement>('.skills-stage')!;
    const guide = section.querySelector<HTMLCanvasElement>('.skills-monogram-guide')!;
    const world = section.querySelector<HTMLElement>('.skills-world')!;
    const words = [...section.querySelectorAll<HTMLElement>('.skills-word')];
    const dust = [...section.querySelectorAll<HTMLElement>('.skills-dust')];
    const ghosts = [...section.querySelectorAll<HTMLElement>('.skills-ghost')];
    const floor = section.querySelector<HTMLElement>('.skills-floor')!;
    const intro = section.querySelector<HTMLElement>('.skills-intro')!;
    const hint = section.querySelector<HTMLElement>('.skills-hint')!;
    const counter = section.querySelector<HTMLElement>('.skills-counter')!;
    const current = section.querySelector<HTMLElement>('.skills-current')!;
    const currentGroup = section.querySelector<HTMLElement>('.skills-current-group')!;
    const chapters = [...section.querySelectorAll<HTMLElement>('.skills-chapter')];
    const rail = section.querySelector<HTMLElement>('.skills-rail-fill')!;
    const lenis = getLenis();
    const events = new AbortController();
    let alive = true, progress = 0, lastProgress = -1, activeIndex = -1, activeGroup = '';
    let width = 0, height = 0, spacing = 420, mobile = false, layoutDirty = true, inFormation = true;
    let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0, lastWorld = '';
    let ridge = words.map((_, i) => .42 + .25 * Math.sin(i * .075) + .16 * Math.sin(i * .19 + 1));
    let drawGuide: (() => void) | undefined;
    let monogram: MonogramPose[] | undefined;
    let contours: Contour[] = [];
    let fallbackPoints: Point[] = [];
    let monogramSize = { width: 1, height: 1 };
    let monogramCentre = { x: 0, y: 0 };
    let monogramFit = 1;
    const formationScale: number[] = [];
    const tunnel: { x: number; y: number; z: number }[] = [];
    const opacity = words.map(() => -1);
    const visibility = words.map(() => false);
    const atmosphere = [...dust, ...ghosts].map(() => ({ opacity: -1, visible: false }));

    section.classList.add('has-fly');
    stage.classList.add('is-forming');
    const layoutMonogram = () => {
      if (!fallbackPoints.length) return;
      monogramFit = mobile ? width * .86 / monogramSize.width
        : Math.min(width * .66 / monogramSize.width, height * .72 / monogramSize.height);
      const fontHeight = Math.max(7, height * .011);
      const sizes = words.map((word) => ({
        width: word.offsetWidth, height: word.offsetHeight,
        font: parseFloat(getComputedStyle(word).fontSize),
      }));
      if (contours.length < 2 || contours.reduce((sum, contour) => sum + Math.floor(contour.length / 6), 0) < words.length) {
        monogram = fallbackPoints.map((point, i) => ({ x: point.x * monogramFit, y: point.y * monogramFit + height * .06, angle: 0, scale: fontHeight * 2.4 / sizes[i].font }));
        stage.dataset.formationMode = 'fill';
        return;
      }
      const total = contours.reduce((sum, contour) => sum + contour.length, 0);
      const allocation = contours.map((contour) => Math.floor(contour.length / total * words.length));
      while (allocation.reduce((sum, count) => sum + count, 0) < words.length) {
        let best = 0;
        contours.forEach((contour, i) => {
          if (contour.length / total * words.length - allocation[i] > contours[best].length / total * words.length - allocation[best]) best = i;
        });
        allocation[best]++;
      }
      const result: MonogramPose[] = [];
      const boxes: { x: number; y: number; width: number; height: number }[] = [];
      contours.forEach((contour, contourIndex) => {
        const count = allocation[contourIndex];
        if (!count) return;
        const allotment = contour.length / count;
        for (let slot = 0; slot < count; slot++) {
          const i = result.length, size = sizes[i];
          let bestPose: MonogramPose | undefined;
          let bestBox: { x: number; y: number; width: number; height: number } | undefined;
          for (const offset of [0, -.15, .15, -.3, .3]) {
            const distance = (slot + .5 + offset) * allotment;
            const point = contourPoint(contour, distance);
            const tangentSpan = Math.min(6, allotment * .3);
            const before = contourPoint(contour, distance - tangentSpan), after = contourPoint(contour, distance + tangentSpan);
            let angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
            if (angle > 90) angle -= 180;
            if (angle < -90) angle += 180;
            const x = (point.x - monogramCentre.x) * monogramFit;
            const y = (point.y - monogramCentre.y) * monogramFit + height * .06;
            let scale = Math.min(fontHeight * 2.4 / size.font, Math.max(.5, allotment * monogramFit - 4) * 2.4 / Math.max(1, size.width));
            const cosine = Math.abs(Math.cos(angle * Math.PI / 180)), sine = Math.abs(Math.sin(angle * Math.PI / 180));
            let box = { x, y, width: 0, height: 0 };
            for (let attempt = 0; attempt < 55; attempt++) {
              const w = size.width * scale / 2.4, h = size.height * scale / 2.4;
              box = { x, y, width: w * cosine + h * sine, height: w * sine + h * cosine };
              const collision = boxes.some((other) => {
                const intersectionWidth = Math.max(0, Math.min(x + box.width / 2, other.x + other.width / 2) - Math.max(x - box.width / 2, other.x - other.width / 2));
                const intersectionHeight = Math.max(0, Math.min(y + box.height / 2, other.y + other.height / 2) - Math.max(y - box.height / 2, other.y - other.height / 2));
                return intersectionWidth * intersectionHeight > .10 * Math.min(box.width * box.height, other.width * other.height);
              });
              if (!collision) break;
              scale *= .84;
            }
            if (!bestPose || scale > bestPose.scale) {
              bestPose = { x, y, angle, scale }; bestBox = box;
            }
          }
          result.push(bestPose!);
          boxes.push(bestBox!);
        }
      });
      monogram = result;
      stage.dataset.formationMode = 'contour';
    };
    const measure = () => {
      width = stage.clientWidth;
      height = stage.clientHeight;
      mobile = window.innerWidth <= 1023;
      spacing = mobile ? 380 : 420;
      words.forEach((_, i) => {
        const angle = i * 137.508 * Math.PI / 180;
        const radius = mix(mobile ? .12 : .14, mobile ? .40 : .46, hash(i)) * width;
        tunnel[i] = {
          x: radius * Math.cos(angle),
          y: gsap.utils.clamp(-.42 * height, .42 * height, radius * Math.sin(angle) * .62),
          z: -i * spacing,
        };
        const fontSize = parseFloat(getComputedStyle(words[i]).fontSize);
        formationScale[i] = Math.max(7, height * .011) * 2.4 / fontSize;
      });
      layoutMonogram();
      dust.forEach((dot, i) => {
        const angle = i * 137.508 * Math.PI / 180;
        const radius = mix(.46, .74, hash(i + 5000)) * width;
        dot.style.transform = `translate3d(${(radius * Math.cos(angle)).toFixed(1)}px,${(radius * Math.sin(angle) * .62).toFixed(1)}px,${(-i * words.length / dust.length * spacing).toFixed(1)}px)`;
      });
      ghosts.forEach((ghost, i) => {
        const side = i % 2 ? 1 : -1;
        ghost.style.transform = `translate3d(${(side * .42 * width).toFixed(1)}px,${((hash(i + 6000) - .5) * .5 * height).toFixed(1)}px,${(-Number(ghost.dataset.i) * spacing).toFixed(1)}px) translate(-50%,-50%) rotateY(${-side * 22}deg)`;
      });
      layoutDirty = true;
    };

    const setWordVisibility = (i: number, shown: boolean, alpha: number) => {
      if (visibility[i] !== shown) {
        words[i].style.visibility = shown ? 'visible' : 'hidden';
        visibility[i] = shown;
      }
      if (shown && (Math.abs(opacity[i] - alpha) > .01 || opacity[i] < 0)) {
        words[i].style.opacity = alpha.toFixed(3);
        opacity[i] = alpha;
      }
    };

    const update = () => {
      const start = import.meta.env.DEV ? performance.now() : 0;
      const p = progress;
      const advance = p <= .26 ? 0 : p <= .5 ? .5 * (p - .26) / .24 : .5 + .5 * clamp((p - .5) / .34);
      const cam = p < .26 ? mix(-3000, -2600, smooth((p - .14) / .12))
        : p <= .5 ? -2600 + advance * words.length * spacing
          : (50 * spacing - 2600) + clamp((p - .5) / .34) * (99 * spacing + 380 - (50 * spacing - 2600));
      const forming = p < .26 || p >= .84;
      if (p !== lastProgress || layoutDirty) {
        const nearest = Math.min(words.length - 1, Math.round(advance * (words.length - 1)));
        if (forming !== inFormation) stage.classList.toggle('is-forming', forming);
        if (nearest !== activeIndex) {
          if (activeIndex >= 0) words[activeIndex].classList.remove('is-near');
          words[nearest].classList.add('is-near');
          activeIndex = nearest;
          const word = words[nearest];
          counter.textContent = String(nearest + 1).padStart(3, '0');
          current.textContent = word.textContent;
          if (word.dataset.group !== activeGroup) {
            activeGroup = word.dataset.group!;
            chapters.forEach((chapter) => chapter.classList.toggle('is-active', chapter.dataset.group === activeGroup));
            currentGroup.textContent = chapters.find((chapter) => chapter.dataset.group === activeGroup)?.querySelector('.skills-chapter-label')?.textContent || '';
          }
        }
        const titleFade = 1 - smooth((p - .14) / .08);
        intro.style.opacity = titleFade.toFixed(3);
        intro.style.transform = `translateY(${(-24 * (1 - titleFade)).toFixed(1)}px)`;
        hint.style.opacity = (1 - smooth((p - .14) / .05)).toFixed(3);
        rail.style.transform = `scaleY(${p.toFixed(5)})`;
        if (monogram) {
          const fit = monogramFit;
          guide.style.width = `${(512 * fit).toFixed(1)}px`;
          guide.style.height = `${(512 * fit).toFixed(1)}px`;
          guide.style.left = `${(width / 2 - monogramCentre.x * fit).toFixed(1)}px`;
          guide.style.top = `${(height * .56 - monogramCentre.y * fit).toFixed(1)}px`;
          guide.style.opacity = (p < .84 ? 1 - smooth((p - .14) / .06) : smooth((p - .90) / .06)).toFixed(3);
        }
        stage.dataset.progress = p.toFixed(5);
        if (!mobile) {
          floor.style.transform = `translate3d(-50%,-100%,${(-cam + ((cam % 140) + 140) % 140).toFixed(1)}px) rotateX(90deg)`;
          floor.style.opacity = (.35 * smooth((p - .14) / .12)).toFixed(3);
        }
        [...dust, ...ghosts].forEach((element, i) => {
          const z = i < dust.length ? -i * words.length / dust.length * spacing : -Number(element.dataset.i) * spacing;
          const depth = z + cam;
          const far = mobile ? -4500 : -6500, near = mobile ? -1800 : -2600;
          const alpha = smooth((depth - far) / (near - far)) * (1 - smooth(depth / 380));
          const shown = p >= .14 && depth >= (mobile ? -5000 : -7000) && depth <= 420 && alpha > .01;
          const state = atmosphere[i];
          if (state.visible !== shown) { element.style.visibility = shown ? 'visible' : 'hidden'; state.visible = shown; }
          if (shown && (Math.abs(state.opacity - alpha) > .01 || state.opacity < 0)) {
            element.style.opacity = (alpha * (i < dust.length ? .22 : .06)).toFixed(3);
            state.opacity = alpha;
          }
        });
        words.forEach((word, i) => {
          const pose = tunnel[i];
          if (!pose) return;
          const depth = pose.z + cam;
          const far = mobile ? -4500 : -6500, near = mobile ? -1800 : -2600;
          const alpha = smooth((depth - far) / (near - far)) * (1 - smooth(depth / 380));
          if (forming) {
            const returning = p >= .84;
            const e = smooth((p - (returning ? .84 : .14) - .02 * hash(i + 3000)) / .10);
            const initial = monogram?.[i] || { x: ((i / (words.length - 1)) - .5) * width * .86, y: (.20 - ridge[i] * .22) * height, angle: 0, scale: formationScale[i] };
            const radius = mix(.34, .56, hash(i + 7000)) * width;
            const distance = Math.hypot(initial.x, initial.y) || 1;
            const burstX = initial.x / distance * radius * 2.4;
            const burstY = initial.y / distance * radius * 2.4;
            let x: number, y: number, z: number, scale: number, angle: number;
            if (!returning) {
              if (e < .45) {
                const t = smooth(e / .45);
                x = mix(initial.x * 2.4, burstX, t); y = mix(initial.y * 2.4, burstY, t);
                z = -1400 - cam; scale = mix(initial.scale, 1, t);
              } else {
                const t = smooth((e - .45) / .55);
                x = mix(burstX, pose.x, t); y = mix(burstY, pose.y, t);
                z = mix(-1400 - cam, pose.z, t); scale = 1;
              }
              angle = initial.angle * (1 - smooth(e / .3));
            } else {
              if (e < .55) {
                const t = smooth(e / .55);
                x = mix(pose.x, burstX, t); y = mix(pose.y, burstY, t);
                z = mix(Math.min(depth, 850) - cam, -1400 - cam, t); scale = 1;
              } else {
                const t = smooth((e - .55) / .45);
                x = mix(burstX, initial.x * 2.4, t); y = mix(burstY, initial.y * 2.4, t);
                z = -1400 - cam; scale = mix(1, initial.scale, t);
              }
              angle = initial.angle * smooth((e - .7) / .3);
            }
            word.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) translate(-50%,-50%) rotateZ(${angle.toFixed(2)}deg) scale(${scale.toFixed(5)})`;
            const fade = returning ? mix(alpha, .95, smooth(e / .5)) : mix(.95, alpha, smooth((e - .5) / .5));
            setWordVisibility(i, true, fade);
          } else {
            const shown = depth >= (mobile ? -5000 : -7000) && depth <= 420 && alpha > 0;
            if (inFormation || layoutDirty) word.style.transform = `translate3d(${pose.x.toFixed(1)}px,${pose.y.toFixed(1)}px,${pose.z.toFixed(1)}px) translate(-50%,-50%)`;
            setWordVisibility(i, shown, alpha);
          }
        });
        inFormation = forming;
        lastProgress = p;
        layoutDirty = false;
      }
      if (!mobile && window.matchMedia('(pointer: fine)').matches) {
        pointerX += (targetX - pointerX) * .08;
        pointerY += (targetY - pointerY) * .08;
      } else {
        pointerX = 0; pointerY = 0;
      }
      const velocity = mobile ? 0 : Math.min(.025, Math.abs(lenis?.velocity || 0) * .002);
      const transform = `rotateY(${(pointerX * 3).toFixed(3)}deg) rotateX(${(-pointerY * 3).toFixed(3)}deg) translate3d(${(pointerX * 30).toFixed(2)}px,${(pointerY * 30).toFixed(2)}px,${cam.toFixed(2)}px) scaleY(${(1 + velocity).toFixed(4)})`;
      if (transform !== lastWorld) { world.style.transform = transform; lastWorld = transform; }
      if (import.meta.env.DEV) {
        samples += performance.now() - start;
        if (++sampleCount === 60) {
          stage.dataset.frameMs = (samples / sampleCount).toFixed(4);
          samples = 0;
          sampleCount = 0;
        }
      }
    };
    let samples = 0, sampleCount = 0;
    const tick = () => update();
    const themeObserver = new MutationObserver(() => drawGuide?.());
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    update();
    const scroll = ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (self) => { progress = self.progress; },
      onRefresh: (self) => { progress = self.progress; layoutDirty = true; update(); },
    });
    let ticking = false;
    const visibilityTrigger = ScrollTrigger.create({
      trigger: section, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        if (self.isActive && !ticking) { ticking = true; gsap.ticker.add(tick); update(); }
        else if (!self.isActive && ticking) { ticking = false; gsap.ticker.remove(tick); }
      },
    });
    stage.addEventListener('pointermove', (event) => {
      if (mobile || !window.matchMedia('(pointer: fine)').matches) return;
      const rect = stage.getBoundingClientRect();
      targetX = gsap.utils.clamp(-1, 1, (event.clientX - rect.left) / rect.width * 2 - 1);
      targetY = gsap.utils.clamp(-1, 1, (event.clientY - rect.top) / rect.height * 2 - 1);
    }, { signal: events.signal });
    stage.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; }, { signal: events.signal });

    document.fonts.ready.then(async () => {
      const family = getComputedStyle(document.querySelector<HTMLElement>('.mono-logo')!).fontFamily;
      await document.fonts.load(`italic 100px ${family}`, 'DŠ');
      if (!alive) return;
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.font = `italic 400px ${family}`;
      const metrics = ctx.measureText('DŠ');
      const glyphWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      if (!glyphWidth || !glyphHeight) return;
      const size = 400 * Math.min(420 / glyphWidth, 420 / glyphHeight);
      ctx.font = `italic ${size}px ${family}`;
      const bounds = ctx.measureText('DŠ');
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
      const textX = 256 + (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2 + bounds.width / 2;
      const textY = 256 + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2;
      ctx.fillText('DŠ', textX, textY);
      const pixels = ctx.getImageData(0, 0, 512, 512).data;
      contours = traceContours(pixels, 512);
      const candidates: { x: number; y: number }[] = [];
      for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
        if (pixels[(y * 512 + x) * 4 + 3] > 180) candidates.push({ x, y });
      }
      if (candidates.length < words.length) return;
      const distances = new Float32Array(candidates.length).fill(Infinity);
      const picked: { x: number; y: number }[] = [];
      let index = Math.floor(hash(601) * candidates.length);
      for (let i = 0; i < words.length; i++) {
        const point = candidates[index];
        picked.push(point);
        let best = -1;
        candidates.forEach((candidate, j) => {
          const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
          distances[j] = Math.min(distances[j], distance);
          if (distances[j] > best) { best = distances[j]; index = j; }
        });
      }
      const xs = candidates.map((point) => point.x), ys = candidates.map((point) => point.y);
      const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      monogramSize = { width: right - left, height: bottom - top };
      monogramCentre = { x: (left + right) / 2, y: (top + bottom) / 2 };
      fallbackPoints = picked.map((point) => ({ x: point.x - monogramCentre.x, y: point.y - monogramCentre.y }));
      measure();
      guide.width = 512; guide.height = 512;
      const guideContext = guide.getContext('2d');
      if (guideContext) {
        drawGuide = () => {
          guideContext.clearRect(0, 0, 512, 512);
          guideContext.font = ctx.font; guideContext.textAlign = 'center'; guideContext.textBaseline = 'alphabetic';
          guideContext.strokeStyle = getComputedStyle(document.body).getPropertyValue('--fg').trim();
          guideContext.globalAlpha = .11; guideContext.lineWidth = .8;
          guideContext.strokeText('DŠ', textX, textY);
        };
        drawGuide();
        stage.classList.add('has-monogram');
      }
      stage.dataset.formation = 'monogram';
      layoutDirty = true;
      if (ticking) update();
    }).catch(() => { /* DEM ridge remains available */ });

    decodeDem(gerlachUrl).then((data) => {
      if (!alive) return;
      const bins = words.map((_, i) => {
        const from = Math.floor(i * 256 / words.length), to = Math.floor((i + 1) * 256 / words.length);
        let max = -Infinity;
        for (let col = from; col < to; col++) for (let row = 0; row < 256; row++) max = Math.max(max, data[row * 256 + col]);
        return max;
      });
      const min = Math.min(...bins), max = Math.max(...bins);
      ridge = bins.map((value) => (value - min) / Math.max(1, max - min));
      layoutDirty = true;
      if (ticking) update();
    }).catch(() => { /* sine ridge remains available */ });

    return () => {
      alive = false;
      gsap.ticker.remove(tick);
      observer.disconnect();
      themeObserver.disconnect();
      events.abort();
      scroll.kill();
      visibilityTrigger.kill();
      section.classList.remove('has-fly');
    };
  });
}
