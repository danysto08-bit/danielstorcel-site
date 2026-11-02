import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

async function open(path, width, height, reduced = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 821, hasTouch: width < 821, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const requests = [];
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(`${path} ${width}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(`${path} ${width}: ${message.text()}`);
  });
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && /\/dem\/(?:traunstein|gerlach|montblanc)\.png/.test(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  check(requests.length === 0, `${path} ${width}: DEMs requested before Summit`);
  return { context, page, requests };
}

async function pin(page, fraction, height) {
  const start = await page.locator('.summit-stage').evaluate((el) => {
    const pin = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return pin.getBoundingClientRect().top + scrollY;
  });
  await page.evaluate((y) => window.scrollTo(0, y), start + 3.8 * height * fraction);
  await page.waitForSelector('#summit.has-3d', { timeout: 30000 });
  await page.waitForTimeout(2200);
  const active = page.locator('.stack-photo[data-active] img');
  if (await active.count()) await active.evaluate(async (img) => {
    img.loading = 'eager';
    await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('Summit photo decode timeout')), 10000))]);
  });
  const result = await page.locator('.summit-stage').evaluate((el) => {
    const canvas = el.querySelector('#terrainCanvas');
    return {
      top: el.getBoundingClientRect().top,
      width: document.documentElement.scrollWidth, viewport: innerWidth,
      calls: Number(canvas.dataset.drawCalls),
      morph: canvas.dataset.morph, level: canvas.dataset.level,
      route: canvas.dataset.route, chapter: canvas.dataset.chapter,
      readout: el.querySelector('#altReadout').textContent,
    };
  });
  console.log('pin', fraction, result);
  check(Math.abs(result.top) < 3, `pin ${fraction}: top ${result.top}`);
  check(result.width === result.viewport, `pin ${fraction}: width ${result.width}/${result.viewport}`);
  check(result.calls > 0 && result.calls < 40, `pin ${fraction}: draw calls ${result.calls}`);
  check(result.level === result.readout, `pin ${fraction}: altitude/readout mismatch`);
  const collisions = await page.evaluate(() => {
    const hud = document.querySelector('.summit-hud').getBoundingClientRect();
    return [...document.querySelectorAll('.hut-label')].filter((label) => {
      const style = getComputedStyle(label);
      if (style.display === 'none' || style.visibility === 'hidden' || +style.opacity < .02) return false;
      const r = label.getBoundingClientRect();
      return r.left < hud.right + 24 && r.right > hud.left - 24 && r.top < hud.bottom + 24 && r.bottom > hud.top - 24;
    }).map((label) => label.textContent);
  });
  check(collisions.length === 0, `pin ${fraction}: hut labels intersect expanded HUD: ${collisions}`);
  if (fraction === .05) {
    const visible = await page.locator('.peak-node').evaluateAll((nodes) => nodes.some((node) => getComputedStyle(node).visibility !== 'hidden' && +getComputedStyle(node).opacity > .01));
    check(!visible, 'peak label visible at .05');
  }
  if ([.34, .66, 1].includes(fraction)) {
    const index = fraction === .34 ? 0 : fraction === .66 ? 1 : 2;
    const geometry = await page.evaluate((i) => {
      const stage = document.querySelector('.summit-stage').getBoundingClientRect();
      const node = document.querySelectorAll('.peak-node')[i];
      const label = node.querySelector('.pk-label').getBoundingClientRect();
      const dot = node.querySelector('.pk-dot').getBoundingClientRect();
      const card = document.querySelector('.stage-right').getBoundingClientRect();
      return { x: (dot.left + dot.width / 2 - stage.left) / stage.width, visible: getComputedStyle(node).visibility !== 'hidden' && +getComputedStyle(node).opacity > .1, overlap: label.left < card.right && label.right > card.left && label.top < card.bottom && label.bottom > card.top };
    }, index);
    console.log('summit framing', fraction, geometry);
    check(geometry.visible && geometry.x >= .25 && geometry.x <= .55 && !geometry.overlap, `summit framing ${fraction}: ${JSON.stringify(geometry)}`);
  }
}

async function sampleLevel(file, fraction) {
  const x = fraction === .2 ? 800 : 600;
  const [top, bottom] = fraction === .2 ? [600, 860] : [380, 650];
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const runs = [];
  let start = -1;
  for (let y = top; y <= bottom; y++) {
    const i = (y * info.width + x) * info.channels;
    const [r, g, b] = data.subarray(i, i + 3);
    const orange = r >= 160 && g >= 30 && r > g * 1.6 && r > b * 2;
    if (orange && start < 0) start = y;
    if ((!orange || y === bottom) && start >= 0) {
      const end = orange && y === bottom ? y : y - 1;
      runs.push({ y: start, length: end - start + 1 });
      start = -1;
    }
  }
  const max = Math.max(0, ...runs.map((run) => run.length));
  console.log('level line sample', fraction, { x, top, bottom, runs, max });
  check(runs.length > 0 && max <= 4, `level line ${fraction}: ${JSON.stringify({ x, runs, max })}`);
}

try {
  if (process.env.SUMMIT_ONLY === '1') {
    const en = await open('/', 1440, 900);
    await pin(en.page, 1, 900);
    await en.page.screenshot({ path: `${out}/w-en-summit-1000.png`, timeout: 30000 });
    console.log('EN DEM requests', en.requests);
    check(new Set(en.requests.map((url) => url.match(/\/dem\/([^/?]+)/)?.[1])).size === 3, 'EN: missing DEM requests');
    await en.context.close();
  } else {
  const en = await open('/', 1440, 900);
  for (const p of [.2, .34, .55, .66, .80, .92, 1]) {
    await pin(en.page, p, 900);
    if (p !== .66) {
      const file = `${out}/f-en-summit-${String(Math.round(p * 1000)).padStart(3, '0')}.png`;
      await en.page.screenshot({ path: file, timeout: 30000 });
      if (p === .2 || p === .92) await sampleLevel(file, p);
    }
  }
  console.log('EN DEM requests', en.requests);
  check(new Set(en.requests.map((url) => url.match(/\/dem\/([^/?]+)/)?.[1])).size === 3, 'EN: missing DEM requests');
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  for (const p of [.55, 1]) await pin(sk.page, p, 900);
  console.log('SK DEM requests', sk.requests);
  check(new Set(sk.requests.map((url) => url.match(/\/dem\/([^/?]+)/)?.[1])).size === 3, 'SK: missing DEM requests');
  await sk.context.close();

  const small = await open('/', 1280, 720);
  await pin(small.page, 1, 720);
  await small.page.screenshot({ path: `${out}/f-en-720-summit-1000.png`, timeout: 30000 });
  await small.context.close();

  const mobile = await open('/', 390, 844);
  const dimensions = await mobile.page.locator('.summit-stage').evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight }));
  for (const [i, y] of [dimensions.top - 40, dimensions.top + dimensions.height / 2 - 300, dimensions.top + dimensions.height - 844].entries()) {
    await mobile.page.evaluate((value) => scrollTo(0, value), y);
    await mobile.page.waitForSelector('#summit.has-3d', { timeout: 30000 });
    await mobile.page.waitForTimeout(1800);
    await mobile.page.screenshot({ path: `${out}/f-en-390-summit-${'abc'[i]}.png`, timeout: 30000 });
    const data = await mobile.page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const canvas = rect('#terrainCanvas'), hud = rect('.altitude'), legend = rect('.peak-legend');
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { width: document.documentElement.scrollWidth, viewport: innerWidth, hudOverlap: overlap(canvas, hud), legendOverlap: overlap(canvas, legend) };
    });
    console.log('mobile', i, data);
    check(data.width === data.viewport && !data.hudOverlap && !data.legendOverlap, `mobile ${i}: ${JSON.stringify(data)}`);
  }
  await mobile.context.close();

  const reduced = await open('/', 1440, 900, true);
  const start = await reduced.page.locator('.summit-stage').evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await reduced.page.evaluate((y) => scrollTo(0, y), start);
  await reduced.page.waitForSelector('#summit.has-3d', { timeout: 30000 });
  await reduced.page.waitForTimeout(2200);
  await reduced.page.screenshot({ path: `${out}/f-reduced-summit.png`, timeout: 30000 });
  const staticLayout = await reduced.page.locator('.summit-stage').evaluate((stage) => {
    const rect = (selector) => stage.querySelector(selector).getBoundingClientRect();
    const frame = rect('.profile-wrap'), hud = rect('.summit-hud'), legend = rect('.peak-legend'), photos = rect('.stage-right');
    const visibleCards = [...stage.querySelectorAll('.stack-photo, .stack-empty')].filter((card) => getComputedStyle(card).display !== 'none').length;
    const visibleLabels = [...stage.querySelectorAll('.hut-label')].filter((label) => getComputedStyle(label).visibility !== 'hidden' && +getComputedStyle(label).opacity > .01).length;
    return {
      frame: { width: frame.width, height: frame.height, bottom: frame.bottom },
      hudTop: hud.top, legendTop: legend.top, photoTop: photos.top, photoWidth: photos.width,
      visibleCards, visibleLabels, readout: stage.querySelector('#altReadout').textContent,
      route: stage.querySelector('#terrainCanvas').dataset.route,
      activePeak: stage.querySelector('.hud-chapter[data-active]')?.textContent,
      width: document.documentElement.scrollWidth, viewport: innerWidth,
    };
  });
  console.log('reduced layout', staticLayout);
  check(staticLayout.frame.width >= 1200 && staticLayout.frame.height <= 900 * .7 + 2 &&
    staticLayout.hudTop >= staticLayout.frame.bottom && staticLayout.legendTop > staticLayout.hudTop &&
    staticLayout.photoTop > staticLayout.legendTop && Math.abs(staticLayout.photoWidth - staticLayout.frame.width) < 2 &&
    staticLayout.visibleCards === 5 && staticLayout.visibleLabels > 0 && staticLayout.readout === '4808' &&
    staticLayout.route === '1.000' && /Mont Blanc/i.test(staticLayout.activePeak || '') &&
    staticLayout.width === staticLayout.viewport, `reduced layout: ${JSON.stringify(staticLayout)}`);
  const hudTop = await reduced.page.locator('.summit-hud').evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await reduced.page.evaluate((y) => scrollTo(0, y), hudTop - 60);
  await reduced.page.waitForTimeout(700);
  await reduced.page.screenshot({ path: `${out}/f-reduced-summit-details.png`, timeout: 30000 });
  await reduced.context.close();
  }
} finally {
  await browser.close();
}
console.log('console errors', errors);
console.log('failures', failures);
if (errors.length || failures.length) process.exitCode = 1;
