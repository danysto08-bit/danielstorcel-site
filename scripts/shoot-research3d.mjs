import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const output = '/tmp/ds-shots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [];

async function pageFor(width, height, { reduced = false, fallback = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(({ fallback }) => {
    sessionStorage.setItem('ds-seen', '1');
    if (fallback) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (kind === 'webgl' || kind === 'webgl2') return null;
        return original.call(this, kind, ...args);
      };
    }
  }, { fallback });
  return { context, page };
}

async function open(page, route, expect3d) {
  await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  if (expect3d) await page.waitForSelector('#research.has-3d', { timeout: 60000 });
  await page.waitForTimeout(1200);
}

async function top(page, selector) {
  return page.locator(selector).evaluate((el) => el.getBoundingClientRect().top + scrollY);
}
async function scroll(page, y) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(1800);
}
async function pinShots(route, prefix, width, height, fractions) {
  const { context, page } = await pageFor(width, height);
  await open(page, route, true);
  await page.evaluate(() => {
    window.svgMutationCount = 0;
    const observer = new MutationObserver((records) => { window.svgMutationCount += records.length; });
    document.querySelectorAll('#research .scope, #research .xsec').forEach((el) => {
      observer.observe(el, { attributes: true, subtree: true });
    });
  });
  const start = await top(page, '.research-pin');
  let maxCalls = 0;
  for (const fraction of fractions) {
    await scroll(page, start + 3.4 * height * Math.min(fraction, 0.999));
    await page.screenshot({ path: `${output}/${prefix}-${String(Math.round(fraction * 100)).padStart(2, '0')}.png` });
    maxCalls = Math.max(maxCalls, Number(await page.locator('#scopeCanvas').getAttribute('data-render-calls')));
    if (fraction >= 0.95) {
      const overlaps = await page.locator('.scope-node').evaluateAll((nodes) => {
        const visible = nodes.filter((node) => {
          const style = getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.1;
        });
        return visible.flatMap((a, i) => visible.slice(i + 1).flatMap((b) => {
          const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
          return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top
            ? [`${a.dataset.scopeNode}/${b.dataset.scopeNode}`] : [];
        }));
      });
      console.log(prefix, `label overlaps at ${fraction}:`, overlaps.length ? overlaps.join(', ') : 'none');
    }
  }
  console.log(prefix, 'has-3d:', await page.locator('#research').evaluate((el) => el.classList.contains('has-3d')),
    'max draw calls:', maxCalls, 'meshes:', await page.locator('#scopeCanvas').getAttribute('data-mesh-count'));
  const mutations = await page.evaluate(() => window.svgMutationCount);
  console.log(prefix, 'hidden SVG mutations during scroll:', mutations);
  if (mutations) throw new Error(`Hidden SVG changed ${mutations} times while 3D was active`);
  await context.close();
}

try {
  await pinShots('/', 'l-en-research', 1440, 900, [0.56, 0.88, 0.95, 1]);
  const slovak = await pageFor(1440, 900);
  await open(slovak.page, '/sk/', true);
  await scroll(slovak.page, await top(slovak.page, '.research-pin') + 3.4 * 900 * 0.88);
  await slovak.context.close();

  const fallback = await pageFor(1440, 900, { fallback: true });
  await open(fallback.page, '/', false);
  const start = await top(fallback.page, '.research-pin');
  await scroll(fallback.page, start + 3.4 * 900 * 0.52);
  await fallback.page.screenshot({ path: `${output}/l-fallback-52.png` });
  const fallbackState = await fallback.page.evaluate(() => ({
    has3d: document.querySelector('#research').classList.contains('has-3d'),
    display: getComputedStyle(document.querySelector('.scope')).display,
    opacity: Number(getComputedStyle(document.querySelector('.scope')).opacity),
    drawn: [...document.querySelectorAll('.scope .draw')].filter((el) =>
      Number.parseFloat(el.style.strokeDashoffset) < Number.parseFloat(el.style.strokeDasharray)).length,
  }));
  const beamOffset = () => fallback.page.locator('#beamI').evaluate((el) => el.style.strokeDashoffset);
  const before = await beamOffset();
  await fallback.page.waitForTimeout(250);
  const after = await beamOffset();
  await fallback.page.locator('#research').evaluate((el) => el.classList.add('has-3d'));
  await fallback.page.waitForTimeout(100);
  const paused = await beamOffset();
  await fallback.page.waitForTimeout(250);
  const stillPaused = await beamOffset();
  await fallback.page.locator('#research').evaluate((el) => el.classList.remove('has-3d'));
  await fallback.page.waitForTimeout(250);
  const resumed = await beamOffset();
  console.log('fallback:', fallbackState, 'beam offset:', { before, after, paused, stillPaused, resumed });
  if (fallbackState.has3d || fallbackState.display === 'none' || fallbackState.opacity <= 0 ||
      !fallbackState.drawn || before === after || paused !== stillPaused || resumed === stillPaused) {
    throw new Error('SVG fallback drawing or ticker failed');
  }
  await fallback.context.close();

  const lost = await pageFor(1440, 900);
  await open(lost.page, '/', true);
  const lostStart = await top(lost.page, '.research-pin');
  await scroll(lost.page, lostStart + 3.4 * 900 * 0.88);
  await lost.page.locator('#scopeCanvas').evaluate((el) =>
    el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await lost.page.waitForTimeout(500);
  const lossState = await lost.page.evaluate(() => ({
    has3d: document.querySelector('#research').classList.contains('has-3d'),
    opacity: Number(getComputedStyle(document.querySelector('.xsec')).opacity),
    trenchHeight: Number(document.querySelector('#trenchClipRect').getAttribute('height')),
  }));
  console.log('simulated context loss at .88:', lossState);
  if (lossState.has3d || lossState.opacity < 0.9 || lossState.trenchHeight < 119) {
    throw new Error('Context-loss fallback did not restore the current SVG progress');
  }
  await scroll(lost.page, lostStart + 3.4 * 900 * 0.52);
  const lostBefore = await lost.page.locator('#beamI').evaluate((el) => el.style.strokeDashoffset);
  await lost.page.waitForTimeout(250);
  const lostAfter = await lost.page.locator('#beamI').evaluate((el) => el.style.strokeDashoffset);
  console.log('context-loss fallback beam offset:', { lostBefore, lostAfter });
  if (lostBefore === lostAfter) throw new Error('Context-loss fallback ticker did not resume');
  await lost.context.close();
} finally {
  await browser.close();
}

if (errors.length) {
  console.error('Console errors:', [...new Set(errors)]);
  process.exitCode = 1;
} else {
  console.log('No console errors');
}
