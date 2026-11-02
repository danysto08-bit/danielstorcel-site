import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4321';
const OUT = '/tmp/ds-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function newPage(width, height, reducedMotion) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page };
}

async function goto(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#preloader', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

const topOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  }, sel);

const scrollTo = (page, y) => page.evaluate((v) => window.scrollTo(0, v), y);

async function shot(page, name) {
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const [path, pfx] of [['/', 'c-en'], ['/sk/', 'c-sk']]) {
  const { ctx, page } = await newPage(1440, 900);
  await goto(page, path);
  await shot(page, `${pfx}-hero`);

  // #record — pinned horizontal, 3 shots across pin
  const recTop = await topOf(page, '#record');
  const recDist = await page.evaluate(() => {
    const t = document.querySelector('.rec-track');
    return t ? t.scrollWidth - window.innerWidth : 0;
  });
  for (const [i, f] of [0.1, 0.5, 0.95].entries()) {
    await scrollTo(page, recTop + recDist * f);
    await shot(page, `${pfx}-record-${i + 1}`);
  }

  // #work
  const workTop = await topOf(page, '#work');
  await scrollTo(page, workTop - 100);
  await shot(page, `${pfx}-work`);

  // #research mid
  const resTop = await topOf(page, '#research');
  await scrollTo(page, resTop - 200);
  await shot(page, `${pfx}-research`);

  // #summit — pinned stage, 3 shots across pin + stats below
  const sumTop = await topOf(page, '.summit-stage');
  const pinDist = 3.2 * 900;
  for (const [i, f] of [0.15, 0.55, 0.98].entries()) {
    await scrollTo(page, sumTop + pinDist * f);
    await shot(page, `${pfx}-summit-${i + 1}`);
  }
  const tailTop = await topOf(page, '.stat-row');
  await scrollTo(page, tailTop - 300);
  await shot(page, `${pfx}-summit-stats`);

  // #skills
  const skTop = await topOf(page, '#skills');
  await scrollTo(page, skTop - 100);
  await shot(page, `${pfx}-skills`);

  // #experience
  const expTop = await topOf(page, '#experience');
  await scrollTo(page, expTop - 200);
  await shot(page, `${pfx}-experience`);

  // #contact
  const conTop = await topOf(page, '#contact');
  await scrollTo(page, conTop - 100);
  await shot(page, `${pfx}-contact`);
  await ctx.close();

  // mobile 390×844: full + key sections
  const m = await newPage(390, 844);
  await goto(m.page, path);
  await m.page.screenshot({ path: `${OUT}/${pfx}-390-hero.png` });
  await m.page.evaluate(() => window.scrollTo(0, 0));
  await m.page.screenshot({ path: `${OUT}/${pfx}-390-full.png`, fullPage: true });
  for (const sel of ['#record', '#summit', '#work']) {
    const t = await topOf(m.page, sel);
    await scrollTo(m.page, t - 60);
    await shot(m.page, `${pfx}-390-${sel.slice(1)}`);
  }
  await m.ctx.close();
}

// 1280x720 record pin check (en)
{
  const { ctx, page } = await newPage(1280, 720);
  await goto(page, '/');
  const recTop = await topOf(page, '#record');
  const recDist = await page.evaluate(() => {
    const t = document.querySelector('.rec-track');
    return t ? t.scrollWidth - window.innerWidth : 0;
  });
  for (const [i, f] of [0.1, 0.5, 0.95].entries()) {
    await scrollTo(page, recTop + recDist * f);
    await shot(page, `c-en-720-record-${i + 1}`);
  }
  await ctx.close();
}

// SK diacritics zoom (2x dsf) — summit nodes + hero eyebrow
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await goto(page, '/sk/');
  const sumTop = await topOf(page, '.summit-stage');
  await scrollTo(page, sumTop + 3.2 * 900 * 0.55);
  await page.waitForTimeout(1800);
  const prof = await page.$('.profile-wrap');
  await prof.screenshot({ path: `${OUT}/c-sk-diacritics-summit.png` });
  await scrollTo(page, 0);
  await page.waitForTimeout(1000);
  const eb = await page.$('.hero-eyebrow');
  await eb.screenshot({ path: `${OUT}/c-sk-diacritics-eyebrow.png` });
  await ctx.close();
}

// reduced-motion full-page run (en)
{
  const { ctx, page } = await newPage(1440, 900, 'reduce');
  await goto(page, '/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/c-reduced-en-full.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log('done →', OUT);
if (errors.length) console.log('CONSOLE ERRORS:', [...new Set(errors)]);
else console.log('no console errors');
