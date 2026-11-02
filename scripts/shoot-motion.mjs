import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [];
const mode = process.env.MOTION_ONLY || 'all';

async function open(path, { width = 1440, height = 900, reduced = false, nojs = false, seen = true, fallback = false, freezeAt = 0 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', javaScriptEnabled: !nojs,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(({ seen, fallback, freezeAt }) => {
    if (seen) sessionStorage.setItem('ds-seen', '1');
    else sessionStorage.removeItem('ds-seen');
    if (freezeAt) {
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) => raf.call(window, (time) => {
        if (Number(document.querySelector('.pl-count')?.textContent) >= freezeAt) {
          window.__motionFrozen = true;
        } else callback(time);
      });
    }
    if (fallback) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (kind === 'webgl' || kind === 'webgl2') return null;
        return original.call(this, kind, ...args);
      };
    }
  }, { seen, fallback, freezeAt });
  await page.goto(`${base}${path}`, { waitUntil: freezeAt ? 'commit' : 'domcontentloaded' });
  if (!nojs && !freezeAt) await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  return { page, context };
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 15000 });
}
async function scroll(page, y, delay = 1800) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(delay);
}
async function top(page, selector) {
  return page.locator(selector).evaluate((el) => el.getBoundingClientRect().top + scrollY);
}

try {
  if (mode === 'all' || mode === 'preloader') {
  for (const value of [40, 85]) {
    const preloader = await open('/', { seen: false, freezeAt: 10 });
    await preloader.page.waitForFunction(() => window.__motionFrozen, null, { polling: 50 });
    await preloader.page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.append(style);
    });
    await preloader.page.evaluate(async (target) => {
      const { gsap } = await import('/src/scripts/motion.ts');
      const tween = gsap.getTweensOf(document.querySelector('.pl-name'))[0];
      const timeline = tween.parent;
      timeline.pause();
      const ease = gsap.parseEase('power3.inOut');
      let low = 0, high = 1;
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (ease(mid) < target / 100) low = mid;
        else high = mid;
      }
      timeline.time(1.05 * (low + high) / 2, false);
    }, value);
    console.log(`preloader ${value}:`, await preloader.page.locator('.pl-count').textContent());
    await screenshot(preloader.page, `n-en-preloader-${value}`);
    await preloader.context.close();
  }
  }
  if (mode === 'all' || mode === 'hero') {
  const fresh = await open('/', { seen: false });
  await fresh.page.waitForSelector('.hero.has-gl');
  await fresh.page.waitForFunction(() => document.querySelector('.hero-name .line-1').children.length > 0);
  await fresh.page.evaluate(async () => {
    const { gsap } = await import('/src/scripts/motion.ts');
    const char = document.querySelector('.hero-name .line-1').children[0];
    const tween = gsap.getTweensOf(char)[0];
    window.__heroIntro = tween.parent;
    window.__heroIntro.pause();
  });
  await fresh.page.waitForTimeout(300);
  await fresh.page.evaluate(() => { window.__heroIntro.time(0.3, false); });
  await fresh.page.waitForTimeout(70);
  await screenshot(fresh.page, 'n-en-hero-0');
  await fresh.page.evaluate(() => { window.__heroIntro.time(1.2, false); });
  await fresh.page.waitForTimeout(70);
  await screenshot(fresh.page, 'n-en-hero-60');
  await fresh.page.evaluate(() => { window.__heroIntro.time(2.6, false); });
  await fresh.page.waitForTimeout(70);
  await fresh.page.waitForSelector('.hero.has-gl');
  await screenshot(fresh.page, 'n-en-hero-100');
  const frameBox = await fresh.page.locator('.hero-photo-frame').boundingBox();
  const stats = await sharp(`${out}/n-en-hero-100.png`).extract({
    left: Math.round(frameBox.x), top: Math.round(frameBox.y),
    width: Math.round(frameBox.width), height: Math.round(frameBox.height),
  }).stats();
  const brightness = stats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;
  console.log('hero photo mean brightness:', brightness);
  if (brightness < 8) throw new Error('WebGL hero photo is blank');
  const heroState = await fresh.page.evaluate(() => ({
    hasGl: document.querySelector('.hero').classList.contains('has-gl'),
    canvas: !!document.querySelector('.hero-gl'),
    imageVisibility: getComputedStyle(document.querySelector('.hero-photo-frame img')).visibility,
  }));
  console.log('hero:', heroState);
  if (!heroState.hasGl || !heroState.canvas || heroState.imageVisibility !== 'hidden') throw new Error('Hero WebGL did not activate');

  const box = await fresh.page.locator('.hero-photo-frame').boundingBox();
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    await fresh.page.mouse.move(box.x + box.width * (0.32 + t * 0.53), box.y + box.height * (0.47 + Math.sin(t * Math.PI * 2) * 0.13));
    await fresh.page.waitForTimeout(22);
  }
  await screenshot(fresh.page, 'n-en-hero-flow');
  await scroll(fresh.page, 0.45 * 900);
  await screenshot(fresh.page, 'n-en-hero-scrolled');
  const scrolled = await fresh.page.locator('.hero-inner').evaluate((el) => getComputedStyle(el).opacity);
  if (Number(scrolled) >= 1) throw new Error('Hero did not fade on scroll');
  await scroll(fresh.page, 330);
  const hover = fresh.page.locator('.desktop-nav a[href="#work"]');
  await hover.hover();
  await fresh.page.waitForTimeout(500);
  await screenshot(fresh.page, 'n-en-header-hover');
  const nav = await fresh.page.evaluate(() => {
    const link = document.querySelector('.desktop-nav a[href="#work"]').getBoundingClientRect();
    const ink = document.querySelector('.nav-ink').getBoundingClientRect();
    return { linkX: link.left, inkX: ink.left, linkWidth: link.width, inkWidth: ink.width,
      index: document.querySelector('.hdr-index').getAttribute('aria-label') };
  });
  console.log('header hover:', nav);
  if (Math.abs(nav.linkX - nav.inkX) > 2 || Math.abs(nav.linkWidth - nav.inkWidth) > 2) throw new Error('Nav underline did not follow hover');

  if (mode === 'all' && !process.env.SKIP_PINS) {
  const titleTop = await top(fresh.page, '.work-title');
  await scroll(fresh.page, titleTop - 900 * 0.83, 500);
  await scroll(fresh.page, titleTop - 900 * 0.74, 320);
  await screenshot(fresh.page, 'n-en-work-title-reveal');
  const charOpacity = await fresh.page.locator('.work-title .mask-line > span').evaluate((el) =>
    [...el.children].map((child) => Number(getComputedStyle(child).opacity)));
  console.log('work title char opacities:', charOpacity);

  const recordTop = await fresh.page.locator('#record').evaluate((el) => {
    const spacer = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return spacer.getBoundingClientRect().top + scrollY;
  });
  const recordDistance = await fresh.page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
  await scroll(fresh.page, recordTop + recordDistance * 0.33);
  await screenshot(fresh.page, 'n-en-pins-record');
  const record = await fresh.page.locator('#record').evaluate((el) => ({
    top: el.getBoundingClientRect().top,
    index: document.querySelector('.hdr-index').getAttribute('aria-label'),
    fit: [...el.querySelectorAll('.rec-bullets')].every((list) => list.scrollHeight <= list.clientHeight + 1),
  }));
  const researchTop = await top(fresh.page, '.research-pin');
  await scroll(fresh.page, researchTop + 3.4 * 900 * 0.56);
  await screenshot(fresh.page, 'n-en-pins-research');
  const research = await fresh.page.locator('.research-pin').evaluate((el) => ({
    top: el.getBoundingClientRect().top, index: document.querySelector('.hdr-index').getAttribute('aria-label'),
  }));
  const summitTop = await top(fresh.page, '.summit-stage');
  await scroll(fresh.page, summitTop + 3.2 * 900 * 0.5);
  await screenshot(fresh.page, 'n-en-pins-summit');
  const summit = await fresh.page.locator('.summit-stage').evaluate((el) => ({
    top: el.getBoundingClientRect().top, index: document.querySelector('.hdr-index').getAttribute('aria-label'),
  }));
  console.log('pins:', { record, research, summit });
  if (!record.fit || [record, research, summit].some((pin) => Math.abs(pin.top) > 3)) throw new Error('A pinned section is mispositioned');
  }
  await fresh.context.close();
  }

  if (mode === 'all') {
  const sk = await open('/sk/');
  await sk.page.waitForSelector('.hero.has-gl');
  await scroll(sk.page, await top(sk.page, '#record') + 500);
  await sk.context.close();
  }

  if (mode === 'all' || mode === 'devices') {
  const mobile = await open('/', { width: 390, height: 844 });
  await mobile.page.waitForSelector('.hero.has-gl');
  await mobile.page.waitForTimeout(2600);
  await screenshot(mobile.page, 'n-en-390-hero');
  await mobile.context.close();

  const reduced = await open('/', { reduced: true });
  await reduced.page.waitForSelector('.hero.has-gl');
  await screenshot(reduced.page, 'n-reduced-hero');
  const reducedState = await reduced.page.evaluate(() => ({
    name: document.querySelector('.hero-name').textContent.trim(),
    clip: getComputedStyle(document.querySelector('.hero-photo-frame')).clipPath,
    dotAnimation: getComputedStyle(document.querySelector('.hero-eyebrow .dot')).animationName,
  }));
  console.log('reduced:', reducedState);
  if (reducedState.dotAnimation !== 'none' || reducedState.clip.includes('100%')) throw new Error('Reduced-motion hero is not static');
  await reduced.context.close();
  }

  if (mode === 'all' || mode === 'nojs') {
  console.log('checking no-JS hero');
  const nojs = await open('/', { nojs: true });
  await nojs.page.waitForLoadState('networkidle', { timeout: 30000 });
  await screenshot(nojs.page, 'n-nojs-hero');
  const nojsState = await nojs.page.evaluate(() => ({
    name: document.querySelector('.hero-name').textContent.trim(),
    image: getComputedStyle(document.querySelector('.hero-photo-frame img')).visibility,
    imageWidth: document.querySelector('.hero-photo-frame img').naturalWidth,
    clip: getComputedStyle(document.querySelector('.hero-photo-frame')).clipPath,
  }));
  console.log('no JS:', nojsState);
  if (nojsState.image !== 'visible' || !nojsState.imageWidth || nojsState.clip !== 'none') throw new Error('No-JS hero photo is hidden');
  await nojs.context.close();
  }

  if (mode === 'all') {
  console.log('checking no-WebGL hero');
  const fallback = await open('/', { fallback: true });
  await fallback.page.waitForTimeout(3000);
  const fallbackState = await fallback.page.evaluate(() => ({
    gl: document.querySelector('.hero').classList.contains('has-gl'),
    image: getComputedStyle(document.querySelector('.hero-photo-frame img')).visibility,
    clip: getComputedStyle(document.querySelector('.hero-photo-frame')).clipPath,
  }));
  console.log('no WebGL:', fallbackState);
  if (fallbackState.gl || fallbackState.image !== 'visible' || fallbackState.clip.includes('100%')) throw new Error('WebGL fallback failed');
  await fallback.context.close();

  const loss = await open('/');
  await loss.page.waitForSelector('.hero.has-gl');
  await loss.page.waitForTimeout(2300);
  await loss.page.locator('.hero-gl').evaluate((el) => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  const lossState = await loss.page.evaluate(() => ({
    gl: document.querySelector('.hero').classList.contains('has-gl'),
    image: getComputedStyle(document.querySelector('.hero-photo-frame img')).visibility,
  }));
  console.log('simulated context loss:', lossState);
  if (lossState.gl || lossState.image !== 'visible') throw new Error('Hero context-loss fallback failed');
  await loss.context.close();
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error('Console errors:', [...new Set(errors)]);
  process.exitCode = 1;
} else console.log('No console errors');
