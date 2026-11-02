import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [];

async function open(path = '/', width = 1440, height = 900, reduced = false) {
  const mobile = width < 821;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1600);
  return { page, context };
}
async function top(page, selector) {
  return page.locator(selector).evaluate((el) => el.getBoundingClientRect().top + scrollY);
}
async function scroll(page, y, delay = 1800) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(delay);
}
const shot = (page, name) => page.screenshot({ path: `${out}/o-${name}.png`, timeout: 30000 });
async function sectionShot(page, selector, name) {
  await page.locator(selector).screenshot({ path: `${out}/o-${name}.png`, timeout: 60000 });
}
async function clippedSectionShot(page, selector, name) {
  const clip = await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
  });
  await page.screenshot({ path: `${out}/o-${name}.png`, fullPage: true, clip, timeout: 60000 });
}
async function recordStart(page) {
  return page.locator('#record').evaluate((el) => {
    const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return box.getBoundingClientRect().top + scrollY;
  });
}
async function record(page, prefix, fractions) {
  const start = await recordStart(page);
  const distance = await page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
  const observations = [];
  for (const fraction of fractions) {
    await scroll(page, start + distance * Math.min(fraction, 0.999), 2200);
    await shot(page, `${prefix}-${Math.round(fraction * 100)}`);
    observations.push(await page.evaluate((fraction) => {
      const stage = document.querySelector('.record-stage').getBoundingClientRect();
      return {
        fraction,
        stageTop: stage.top,
        counter: document.querySelector('.rec-counter').getAttribute('aria-label'),
        panels: [...document.querySelectorAll('.rec-panel')].map((panel) => {
          const rect = panel.getBoundingClientRect();
          const bullets = panel.querySelector('.rec-bullets');
          const media = panel.querySelector('.rec-photo, .rec-poster').getBoundingClientRect();
          return { left: rect.left, right: rect.right, opacity: getComputedStyle(panel).opacity,
            transform: panel.style.transform, bullets: [bullets.scrollHeight, bullets.clientHeight],
            mediaBottom: media.bottom, stageBottom: stage.bottom,
            statOpacity: [...panel.querySelector('.rec-stat').children].map((node) => getComputedStyle(node).opacity) };
        }),
      };
    }, fraction));
  }
  console.log(prefix, JSON.stringify({ distance, observations }));
  for (const observation of observations) {
    if (Math.abs(observation.stageTop) > 3 || observation.panels.some((panel) =>
      panel.bullets[0] > panel.bullets[1] + 1 || panel.mediaBottom > panel.stageBottom + 1)) {
      throw new Error(`${prefix}: a panel does not fit in the pinned stage`);
    }
  }
  const last = observations.find((observation) => observation.fraction === 1);
  if (last && last.panels.at(-1).right > page.viewportSize().width + 1) throw new Error(`${prefix}: final panel is cut off`);
}

try {
  if (!process.env.PHASE2_ONLY || process.env.PHASE2_ONLY === 'desktop') {
  const en = await open();
  const frame = await en.page.locator('.hero-photo-frame').boundingBox();
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    await en.page.mouse.move(frame.x + frame.width * (0.28 + 0.56 * t), frame.y + frame.height * (0.45 + Math.sin(t * Math.PI * 2) * 0.16));
    if (i < 36) await en.page.waitForTimeout(16);
  }
  await shot(en.page, 'en-hero-flow');

  const about = await top(en.page, '#about');
  await scroll(en.page, about - 900 * 0.8);
  await shot(en.page, 'en-about-enter');
  await scroll(en.page, await top(en.page, '.about-statement') - 900 * 0.58);
  await shot(en.page, 'en-about-mid');
  await scroll(en.page, await top(en.page, '.about-photo') - 90);
  const photo = await en.page.locator('.about-media').boundingBox();
  await en.page.mouse.move(photo.x + photo.width * 0.3, photo.y + photo.height * 0.4);
  await en.page.waitForTimeout(900);
  await shot(en.page, 'en-about-photo');
  const aboutState = await en.page.evaluate(() => ({
    clip: getComputedStyle(document.querySelector('.about-photo')).clipPath,
    transform: getComputedStyle(document.querySelector('.about-photo')).transform,
    glare: getComputedStyle(document.querySelector('.glare')).opacity,
    caption: document.querySelector('.about-photo figcaption').getBoundingClientRect().bottom,
  }));
  console.log('about:', aboutState);
  if (aboutState.clip.includes('12%') || Number(aboutState.glare) < 0.5 || aboutState.transform === 'none') throw new Error('About photo reveal or hover did not run');
  await en.page.mouse.move(5, 5);

  await record(en.page, 'en-record', [0, 0.33, 0.66, 1]);
  const row = en.page.locator('.work-row').nth(1);
  await scroll(en.page, await top(en.page, '.work-list') - 900 * 0.31);
  const box = await row.boundingBox();
  await en.page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.45);
  await en.page.waitForTimeout(1000);
  await shot(en.page, 'en-work-hover');
  const preview = await en.page.locator('.work-preview').evaluate((el) => ({
    opacity: getComputedStyle(el).opacity, rect: el.getBoundingClientRect().toJSON(),
    grynade: getComputedStyle(el.querySelector('.grynade')).backgroundColor,
  }));
  if (Number(preview.opacity) < 0.9 || preview.grynade !== 'rgb(255, 79, 31)') throw new Error('Work preview is not shown');
  await row.click();
  await en.page.waitForTimeout(1800);
  await en.page.mouse.move(5, 895);
  await en.page.evaluate(() => window.scrollBy(0, 24));
  await en.page.waitForTimeout(700);
  await shot(en.page, 'en-work-open');
  const openState = await row.evaluate((el) => ({
    expanded: el.getAttribute('aria-expanded'), bodyHidden: document.getElementById(el.getAttribute('aria-controls')).hidden,
    lineCount: document.querySelector('#work-body-1 .w-desc').children.length,
  }));
  console.log('work:', { preview, openState });
  if (openState.expanded !== 'true' || openState.bodyHidden || !openState.lineCount) throw new Error('Work accordion did not open');

  const researchTop = await top(en.page, '.research-pin');
  await scroll(en.page, researchTop + 3.4 * 900 * 0.56);
  await shot(en.page, 'en-pins-research');
  const research = await en.page.locator('.research-pin').evaluate((el) => ({ top: el.getBoundingClientRect().top, gl: el.closest('#research').classList.contains('has-3d') }));
  const summitTop = await top(en.page, '.summit-stage');
  await scroll(en.page, summitTop + 3.2 * 900 * 0.5);
  await shot(en.page, 'en-pins-summit');
  const summit = await en.page.locator('.summit-stage').evaluate((el) => ({ top: el.getBoundingClientRect().top, gl: el.closest('#summit').classList.contains('has-3d') }));
  console.log('pins:', { research, summit });
  if ([research, summit].some((pin) => Math.abs(pin.top) > 3 || !pin.gl)) throw new Error('Research or Summit pin failed');
  await en.context.close();

  const small = await open('/', 1280, 720);
  await record(small.page, 'en-720-record', [0.66]);
  await small.context.close();

  const sk = await open('/sk/');
  await scroll(sk.page, await top(sk.page, '.about-photo') - 100);
  await record(sk.page, 'sk-record', [0.66]);
  await scroll(sk.page, await top(sk.page, '.work-list') - 200);
  await sk.page.locator('.work-row').nth(1).click();
  await sk.page.waitForTimeout(1200);
  if (await sk.page.locator('.work-row').nth(1).getAttribute('aria-expanded') !== 'true') throw new Error('SK accordion failed');
  await sk.context.close();
  }

  if (!process.env.PHASE2_ONLY || process.env.PHASE2_ONLY === 'mobile') {
  const mobile = await open('/', 390, 844);
  await mobile.page.addStyleTag({ content: '#siteHeader,.skip-link,#scrollProgress{display:none!important}' });
  await scroll(mobile.page, await top(mobile.page, '#about') + 80);
  await shot(mobile.page, 'en-390-about');
  await scroll(mobile.page, await top(mobile.page, '.about-photo') - 200);
  await mobile.page.locator('.about-photo img').evaluate((img) => img.decode());
  await shot(mobile.page, 'en-390-about-photo');
  await scroll(mobile.page, await top(mobile.page, '.work-list') - 150);
  await sectionShot(mobile.page, '#work', 'en-390-work');
  const mobileState = await mobile.page.evaluate(() => ({
    record: getComputedStyle(document.querySelector('.rec-track')).flexDirection,
    preview: getComputedStyle(document.querySelector('.work-preview')).display,
  }));
  console.log('mobile:', mobileState);
  if (mobileState.record !== 'column' || mobileState.preview !== 'none') throw new Error('Mobile fallback failed');
  await mobile.context.close();
  }

  if (!process.env.PHASE2_ONLY || process.env.PHASE2_ONLY === 'reduced') {
  const reduced = await open('/', 1440, 900, true);
  await reduced.page.addStyleTag({ content: '#siteHeader,.skip-link,#scrollProgress{display:none!important}' });
  await scroll(reduced.page, await top(reduced.page, '.about-photo') - 200);
  await reduced.page.locator('.about-photo img').evaluate((img) => img.decode());
  await clippedSectionShot(reduced.page, '#about', 'reduced-about');
  const recordImages = reduced.page.locator('.rec-photo img');
  for (let i = 0; i < await recordImages.count(); i++) {
    await recordImages.nth(i).scrollIntoViewIfNeeded();
    await recordImages.nth(i).evaluate((img) => img.decode());
  }
  await scroll(reduced.page, await top(reduced.page, '#record') + 200);
  await clippedSectionShot(reduced.page, '#record', 'reduced-record');
  await sectionShot(reduced.page, '#work', 'reduced-work');
  const reducedState = await reduced.page.evaluate(() => ({
    record: getComputedStyle(document.querySelector('.rec-track')).flexDirection,
    preview: getComputedStyle(document.querySelector('.work-preview')).display,
    photo: getComputedStyle(document.querySelector('.about-photo')).clipPath,
  }));
  console.log('reduced:', reducedState);
  if (reducedState.record !== 'column' || reducedState.preview !== 'none' || reducedState.photo.includes('12%')) throw new Error('Reduced-motion fallback failed');
  await reduced.context.close();
  }
} finally {
  await browser.close();
  if (errors.length) console.error('Console errors:', [...new Set(errors)]);
}
if (errors.length) {
  process.exitCode = 1;
} else console.log('No console errors');
