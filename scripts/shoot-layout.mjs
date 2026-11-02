import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (condition, description) => { if (!condition) failures.push(description); };

async function open(path, width, height, reduced = false) {
  const mobile = width < 821;
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${path} ${width}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(`${path} ${width}: ${message.text()}`);
  });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('.hero.has-gl', { timeout: 20000 });
  await page.waitForTimeout(2200);
  return { context, page };
}
const shot = (page, name) => page.screenshot({ path: `${out}/p-${name}.png`, timeout: 30000 });
const top = (page, selector) => page.locator(selector).evaluate((el) => el.getBoundingClientRect().top + scrollY);
async function scroll(page, y, delay = 1700) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(delay);
}
async function width(page, label) {
  const result = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
  }));
  console.log('width', label, result);
  check(result.document === result.viewport, `${label}: document ${result.document} != viewport ${result.viewport}`);
}
async function hero(page, name, desktop = true) {
  await shot(page, name);
  const result = await page.evaluate(() => {
    const frame = document.querySelector('.hero-photo-frame').getBoundingClientRect();
    const line = document.querySelector('.hero-name .line-2');
    const range = document.createRange();
    range.selectNodeContents(line);
    const glyphs = range.getBoundingClientRect();
    const name = document.querySelector('.hero-name').getBoundingClientRect();
    return {
      frameLeft: frame.left, frameWidth: frame.width, glyphLeft: glyphs.left, glyphRight: glyphs.right,
      nameLeft: name.left, nameRight: name.right, overlap: (glyphs.right - frame.left) / frame.width,
      font: getComputedStyle(document.querySelector('.hero-name')).fontSize,
      gradient: getComputedStyle(document.querySelector('.hero-photo-frame'), '::after').backgroundImage,
      gl: document.querySelector('.hero').classList.contains('has-gl'),
      fallbackSkew: document.querySelector('.hero-photo-frame img').hasAttribute('data-velocity-skew'),
      viewport: innerWidth,
    };
  });
  console.log('hero', name, result);
  check(result.gl && result.fallbackSkew, `${name}: hero GL or fallback skew missing`);
  check(result.glyphLeft >= 0 && result.glyphRight <= result.viewport, `${name}: name clipped`);
  if (desktop) {
    check(result.overlap >= 0.07 && result.overlap <= 0.13, `${name}: name overlaps ${(result.overlap * 100).toFixed(1)}%`);
    check(result.gradient.includes('linear-gradient'), `${name}: photo gradient missing`);
  }
}
async function record(page, name, progress) {
  const position = await page.locator('#record').evaluate((el) => {
    const pin = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return pin.getBoundingClientRect().top + scrollY;
  });
  const distance = await page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
  await scroll(page, position + distance * progress, 2300);
  const decoded = await page.evaluate(async () => {
    const visible = [...document.querySelectorAll('.rec-photo img')].filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.right > 0 && rect.left < innerWidth;
    });
    await Promise.all(visible.map((img) => img.decode()));
    return visible.length;
  });
  check(decoded > 0, `${name}: no visible Record photo decoded`);
  await shot(page, name);
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.record-stage').getBoundingClientRect();
    const head = document.querySelector('.rec-head').getBoundingClientRect();
    return {
      stageTop: stage.top, stageBottom: stage.bottom, headHeight: head.height,
      panels: [...document.querySelectorAll('.rec-panel')].map((panel) => {
        const bullets = panel.querySelector('.rec-bullets');
        const frame = panel.querySelector('.rec-photo, .rec-poster');
        const box = frame.getBoundingClientRect();
        const caption = frame.querySelector('figcaption');
        const style = getComputedStyle(frame);
        return {
          bullets: [bullets.scrollHeight, bullets.clientHeight], bottom: box.bottom,
          caption: caption.textContent.trim(), captionBottom: caption.getBoundingClientRect().bottom,
          border: style.borderTopWidth, padding: style.paddingTop,
        };
      }),
    };
  });
  console.log('record', name, JSON.stringify(result));
  check(Math.abs(result.stageTop) < 3, `${name}: pin offset`);
  check(result.headHeight <= 190, `${name}: header ${result.headHeight}px`);
  result.panels.forEach((panel, index) => {
    check(panel.bullets[0] <= panel.bullets[1] + 1, `${name}: panel ${index + 1} bullets clipped`);
    check(panel.bottom <= result.stageBottom + 1 && panel.captionBottom <= panel.bottom + 2, `${name}: panel ${index + 1} media clipped`);
    check(panel.border === '1px' && panel.padding === '6px' && panel.caption.length > 0, `${name}: panel ${index + 1} frame incomplete`);
  });
  await width(page, name);
}
async function heading(page, selector, name, offset = 40) {
  if (selector === '#experience') {
    await scroll(page, await top(page, '.xp-column:last-child') - page.viewportSize().height * 0.65);
  }
  await scroll(page, await top(page, selector) - offset);
  await shot(page, name);
  await width(page, name);
}

try {
  const en = await open('/', 1440, 900);
  await hero(en.page, 'en-hero');
  await width(en.page, 'en-hero');
  const layout = await en.page.evaluate(() => {
    const selectors = ['.rec-title', '.work-title', '.res-title', '.skills-title', '.exp-title', '.stage-context-title'];
    const sizes = Object.fromEntries(selectors.map((selector) => [selector, getComputedStyle(document.querySelector(selector)).fontSize]));
    const ghosts = [...document.querySelectorAll('.ghost-index')].map((el) => ({
      value: el.textContent, section: el.closest('section').id,
      researchCopy: !!el.closest('.research-copy'), canvas: !!el.closest('.stage-canvas'),
    }));
    const grids = [...document.querySelectorAll('.section-grid')].map((el) => ({
      section: el.id, background: getComputedStyle(el, '::before').backgroundImage,
    }));
    return { sizes, ghosts, grids };
  });
  console.log('layout', JSON.stringify(layout));
  check(new Set(Object.values(layout.sizes)).size === 1, 'section heading scales differ');
  check(layout.ghosts.map((g) => g.value).join(',') === '01,03,04,06,07,08', 'ghost indices missing');
  check(layout.ghosts.find((g) => g.value === '04')?.researchCopy && !layout.ghosts.find((g) => g.value === '04')?.canvas, 'research ghost placement');
  check(layout.grids.length === 4 && layout.grids.every((g) => g.background.includes('repeating-linear-gradient')), 'section grids missing');

  await en.page.evaluate((y) => window.scrollTo(0, y), await top(en.page, '#about') - 80);
  let scan;
  try {
    await en.page.waitForFunction(() => document.body.dataset.theme === 'paper' && Number(getComputedStyle(document.getElementById('themeScan')).opacity) > 0, null, { timeout: 2500 });
    scan = await en.page.locator('#themeScan').evaluate((el) => ({
      opacity: getComputedStyle(el).opacity, y: new DOMMatrix(getComputedStyle(el).transform).m42,
    }));
  } catch { failures.push('theme scan did not animate on a theme change'); }
  console.log('theme scan', scan);
  await en.page.waitForTimeout(1800);
  await shot(en.page, 'en-about');
  const aboutFrame = await en.page.locator('.about-photo').evaluate((el) => ({
    border: getComputedStyle(el).borderTopWidth, padding: getComputedStyle(el).paddingTop,
  }));
  check(aboutFrame.border === '1px' && aboutFrame.padding === '6px', 'about frame incomplete');
  await width(en.page, 'en-about');
  await record(en.page, 'en-record-33', 0.33);
  await heading(en.page, '#work', 'en-work');
  await scroll(en.page, await top(en.page, '.research-pin'), 2000);
  await shot(en.page, 'en-research-head');
  const research = await en.page.locator('.research-pin').evaluate((el) => ({ top: el.getBoundingClientRect().top, gl: el.closest('#research').classList.contains('has-3d') }));
  check(Math.abs(research.top) < 3 && research.gl, 'research pin failed');
  await width(en.page, 'en-research-head');
  await scroll(en.page, await top(en.page, '.summit-stage') + 3.2 * 900 * 0.25, 2000);
  await shot(en.page, 'en-summit-25');
  const summit = await en.page.locator('.summit-stage').evaluate((el) => {
    const frame = el.querySelector('.stack-photo');
    return { top: el.getBoundingClientRect().top, gl: el.closest('#summit').classList.contains('has-3d'),
      border: getComputedStyle(frame).borderTopWidth, padding: getComputedStyle(frame).paddingTop,
      caption: frame.querySelector('figcaption').textContent.trim() };
  });
  console.log('pins', { research, summit });
  check(Math.abs(summit.top) < 3 && summit.gl && summit.border === '1px' && summit.padding === '6px' && !!summit.caption, 'summit pin or frame failed');
  await width(en.page, 'en-summit-25');
  await heading(en.page, '#skills', 'en-skills');
  await heading(en.page, '#experience', 'en-experience');
  await heading(en.page, '#contact', 'en-contact', 0);
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  await hero(sk.page, 'sk-hero');
  await width(sk.page, 'sk-hero');
  for (const section of ['#about', '#work', '#research', '#skills', '#experience', '#contact']) {
    await scroll(sk.page, await top(sk.page, section) + 80, 700);
    await width(sk.page, `sk-${section}`);
  }
  await sk.context.close();

  const small = await open('/', 1280, 720);
  await hero(small.page, 'en-720-hero');
  await width(small.page, 'en-720-hero');
  await record(small.page, 'en-720-record-50', 0.5);
  await small.context.close();
  const skSmall = await open('/sk/', 1280, 720);
  await hero(skSmall.page, 'sk-720-hero');
  await width(skSmall.page, 'sk-720-hero');
  await record(skSmall.page, 'sk-720-record-50', 0.5);
  await skSmall.context.close();

  const mobile = await open('/', 390, 844);
  await hero(mobile.page, 'en-390-hero', false);
  await width(mobile.page, 'en-390-hero');
  await heading(mobile.page, '#about', 'en-390-about', -40);
  await heading(mobile.page, '#work', 'en-390-work', -40);
  await heading(mobile.page, '#experience', 'en-390-experience', -40);
  await mobile.context.close();
  const skMobile = await open('/sk/', 390, 844);
  await width(skMobile.page, 'sk-390-hero');
  for (const section of ['#about', '#record', '#work', '#research', '#summit', '#skills', '#experience', '#contact']) {
    await scroll(skMobile.page, await top(skMobile.page, section) + 80, 650);
    await width(skMobile.page, `sk-390-${section}`);
  }
  await skMobile.context.close();

  const reduced = await open('/', 1440, 900, true);
  await hero(reduced.page, 'reduced-hero');
  await scroll(reduced.page, await top(reduced.page, '#about') - 80);
  const reducedScan = await reduced.page.locator('#themeScan').evaluate((el) => getComputedStyle(el).opacity);
  check(reducedScan === '0', 'theme scan moved in reduced motion');
  await reduced.context.close();
} finally {
  await browser.close();
}
if (errors.length) console.error('Console errors:', [...new Set(errors)]);
if (failures.length) console.error('Failures:', failures);
if (errors.length || failures.length) process.exitCode = 1;
else console.log('All checks passed; no console errors');
