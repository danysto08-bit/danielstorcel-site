import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

async function open(path, width, height, reduced = false, javascript = true) {
  const mobile = width < 821;
  const context = await browser.newContext({
    viewport: { width, height }, isMobile: mobile, hasTouch: mobile, javaScriptEnabled: javascript,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(`${path} ${width}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(`${path} ${width}: ${message.text()}`);
  });
  if (javascript) await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  if (javascript) await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1300);
  return { context, page };
}

async function scrollToProgress(page, p) {
  const geometry = await page.locator('#skills').evaluate((el) => ({
    top: el.getBoundingClientRect().top + scrollY, distance: el.offsetHeight - innerHeight,
  }));
  await page.evaluate((y) => window.scrollTo(0, y), geometry.top + p * geometry.distance);
  await page.waitForTimeout(2200);
  return geometry;
}

async function inspect(page, label, p, screenshot = true) {
  await scrollToProgress(page, p);
  const result = await page.evaluate(() => {
    const section = document.querySelector('#skills'), stage = section.querySelector('.skills-stage');
    const words = [...section.querySelectorAll('.skills-word')];
    const visible = words.filter((word) => getComputedStyle(word).visibility !== 'hidden' && +getComputedStyle(word).opacity > .05);
    const countVisible = visible.length;
    const stageRect = stage.getBoundingClientRect();
    const formationWords = words.filter((word) => getComputedStyle(word).visibility !== 'hidden' && +getComputedStyle(word).opacity > .5);
    const rects = formationWords.map((word) => word.getBoundingClientRect());
    let maxOverlap = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      maxOverlap = Math.max(maxOverlap, overlapWidth * overlapHeight / Math.min(a.width * a.height, b.width * b.height));
    }
    const visibleRects = visible.map((word) => word.getBoundingClientRect());
    const spread = visibleRects.length ? (Math.max(...visibleRects.map((r) => r.right)) - Math.min(...visibleRects.map((r) => r.left))) / stageRect.width : 0;
    const introRects = [...stage.querySelectorAll('.skills-intro .skills-title, .skills-intro .skills-sub')].flatMap((el) => {
      const rects = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        rects.push(range.getBoundingClientRect());
      }
      return rects;
    });
    const introCollisions = rects.filter((r) => introRects.some((s) => r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top)).length;
    const bounds = rects.length ? {
      width: (Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left))) / stageRect.width,
      height: (Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))) / stageRect.height,
    } : null;
    return {
      progress: +stage.dataset.progress, counter: section.querySelector('.skills-counter').textContent,
      current: section.querySelector('.skills-current').textContent, group: section.querySelector('.skills-current-group').textContent,
      words: words.length, visible: countVisible, list: getComputedStyle(section.querySelector('.skills-list')).display,
      accessible: section.querySelectorAll('.skills-accessible li').length,
      formation: stage.dataset.formation, formationMode: stage.dataset.formationMode, formationCount: formationWords.length, bounds, maxOverlap, spread, introCollisions,
      firstSix: words.slice(0, 6).map((word) => ({ opacity: +getComputedStyle(word).opacity, visibility: getComputedStyle(word).visibility })),
      top: stage.getBoundingClientRect().top, width: document.documentElement.scrollWidth, viewport: innerWidth,
    };
  });
  console.log(label, p, result);
  check(result.words === 100 && result.list === 'none' && result.accessible === 100, `${label} ${p}: content ${JSON.stringify(result)}`);
  check(result.width === result.viewport, `${label} ${p}: width ${result.width}/${result.viewport}`);
  check(Math.abs(result.progress - p) < .005, `${label} ${p}: progress ${result.progress}`);
  check(Math.abs(result.top) <= 3, `${label} ${p}: sticky top ${result.top}`);
  if (p === .5) check(result.visible >= 6 && result.visible <= 30 && result.counter === '051', `${label}: midpoint ${JSON.stringify(result)}`);
  if (p === 0 || p === .14 || p === 1) {
    check(result.formation === 'monogram' && result.formationMode === 'contour' && result.formationCount >= 90 && result.bounds?.width <= (result.viewport <= 1023 ? .9 : .7) && result.bounds?.height <= .75, `${label}: monogram ${JSON.stringify(result)}`);
    if (p !== .14) check(result.maxOverlap <= .15, `${label}: monogram overlap ${result.maxOverlap}`);
  }
  if (p === 1) check(result.counter === '100', `${label}: final counter ${result.counter}`);
  if (p === 0 && result.viewport >= 1024) check(result.introCollisions === 0, `${label}: monogram intersects title ${result.introCollisions}`);
  if ((p === .12 || p === .28) && label === 'k2-en-skills') check(result.firstSix.every((word) => word.visibility === 'visible' && word.opacity > .5), `${label}: first skills ${JSON.stringify(result.firstSix)}`);
  if ((p === .2 || p === .9) && label === 'k2-en-skills') check(result.spread >= .45, `${label}: burst spread ${result.spread}`);
  if (screenshot) await page.screenshot({ path: `${out}/${label}-${String(Math.round(p * 1000)).padStart(3, '0')}.png`, timeout: 30000 });
}

try {
  const en = await open('/', 1440, 900);
  for (const p of [0, .03, .06, .08, .12, .14, .20, .25, .28, .5, .75, .90, .99, 1]) await inspect(en.page, 'k2-en-skills', p, p !== .12 && p !== .28);
  const geometry = await scrollToProgress(en.page, .5);
  const timing = await en.page.evaluate(async ({ top, distance }) => {
    const stage = document.querySelector('.skills-stage');
    delete stage.dataset.frameMs;
    const center = top + distance * .5;
    await new Promise((resolve) => {
      let frames = 0;
      const frame = () => {
        scrollTo(0, center + (frames % 2 ? 4 : -4));
        if (++frames < 130) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    return { averageMs: Number(stage.dataset.frameMs), progress: stage.dataset.progress, frames: 130 };
  }, geometry);
  console.log('frame cost', timing);
  check(Number.isFinite(timing.averageMs) && timing.averageMs < 4, `frame cost ${JSON.stringify(timing)}`);
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  await inspect(sk.page, 'k2-sk-skills', .5);
  await sk.context.close();

  const small = await open('/', 1280, 720);
  await inspect(small.page, 'k2-en-720-skills', 0, false);
  await inspect(small.page, 'k2-en-720-skills', .5);
  await small.context.close();

  const mobile = await open('/', 390, 844);
  for (const p of [0, .5]) await inspect(mobile.page, 'k2-en-390-skills', p);
  await mobile.context.close();

  const reduced = await open('/', 1440, 900, true);
  const reducedTop = await reduced.page.locator('#skills').evaluate((section) => section.getBoundingClientRect().top + scrollY);
  await reduced.page.evaluate((top) => scrollTo(0, top), reducedTop);
  await reduced.page.waitForTimeout(800);
  const fallback = await reduced.page.locator('#skills').evaluate((section) => ({
    fly: section.classList.contains('has-fly'), stage: getComputedStyle(section.querySelector('.skills-stage')).display,
    list: getComputedStyle(section.querySelector('.skills-list')).display, items: section.querySelectorAll('.skills-list li').length,
    height: section.offsetHeight, width: document.documentElement.scrollWidth, viewport: innerWidth,
  }));
  console.log('reduced', fallback);
  check(!fallback.fly && fallback.stage === 'none' && fallback.list !== 'none' && fallback.items === 100 && fallback.height < 3000 && fallback.width === fallback.viewport, `reduced: ${JSON.stringify(fallback)}`);
  await reduced.page.screenshot({ path: `${out}/k2-reduced-skills.png`, timeout: 30000 });
  await reduced.context.close();

  const nojs = await open('/', 1440, 900, false, false);
  const nojsData = await nojs.page.locator('#skills').evaluate((section) => ({
    fly: section.classList.contains('has-fly'), stage: getComputedStyle(section.querySelector('.skills-stage')).display,
    list: getComputedStyle(section.querySelector('.skills-list')).display, items: section.querySelectorAll('.skills-list li').length,
  }));
  console.log('no JS', nojsData);
  check(!nojsData.fly && nojsData.stage === 'none' && nojsData.list !== 'none' && nojsData.items === 100, `no JS: ${JSON.stringify(nojsData)}`);
  await nojs.context.close();
} finally {
  await browser.close();
}
console.log('console errors', errors);
console.log('failures', failures);
if (errors.length || failures.length) process.exitCode = 1;
