import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const output = '/tmp/ds-shots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [];

async function open(route, width, height, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  return { context, page };
}

async function scroll(page, y) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(1800);
}

async function record(page, name, fractions) {
  const { top, distance } = await page.evaluate(() => ({
    top: document.querySelector('#record').getBoundingClientRect().top + scrollY,
    distance: Math.max(0, document.querySelector('.rec-track').scrollWidth - innerWidth + 64),
  }));
  for (const progress of fractions) {
    await scroll(page, top + distance * Math.min(progress, 0.999));
    await page.screenshot({ path: `${output}/${name}-${Math.round(progress * 100)}.png` });
  }
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.record-stage').getBoundingClientRect();
    const head = document.querySelector('.rec-head').getBoundingClientRect();
    return {
      stageHeight: stage.height,
      headHeight: head.height,
      distance: Math.max(0, document.querySelector('.rec-track').scrollWidth - innerWidth + 64),
      panels: [...document.querySelectorAll('.rec-panel')].map((panel) => {
        const bullets = panel.querySelector('.rec-bullets');
        const media = panel.querySelector('.rec-photo, .rec-poster').getBoundingClientRect();
        return {
          title: panel.querySelector('.rec-item-title').textContent,
          scrollHeight: bullets.scrollHeight,
          clientHeight: bullets.clientHeight,
          mediaBottom: Math.round(media.bottom * 100) / 100,
          stageBottom: Math.round(stage.bottom * 100) / 100,
        };
      }),
    };
  });
  console.log(name, JSON.stringify(result));
  if (Math.abs(result.stageHeight - page.viewportSize().height) > 1 || result.headHeight > 170 ||
      result.panels.some((panel) => panel.scrollHeight > panel.clientHeight + 1 || panel.mediaBottom > panel.stageBottom + 1)) {
    throw new Error(`${name}: record content does not fit`);
  }
}

async function experience(page, filename, expected) {
  const title = page.locator('#experience .exp-title');
  await scroll(page, await title.evaluate((el) => el.getBoundingClientRect().top + scrollY - innerHeight * 0.6));
  const rows = page.locator('#experience .exp-row');
  for (let i = 0; i < await rows.count(); i++) {
    await scroll(page, await rows.nth(i).evaluate((el) => el.getBoundingClientRect().top + scrollY - innerHeight * 0.6));
  }
  const data = await rows.evaluateAll((elements) => elements.map((row) => ({
    title: row.querySelector('.exp-name').textContent.trim(),
    offsets: [...row.querySelectorAll('.mask-line > span')].map((el) => new DOMMatrix(getComputedStyle(el).transform).m42),
  })));
  console.log(filename, JSON.stringify(data));
  if (JSON.stringify(data.map((row) => row.title)) !== JSON.stringify(expected) ||
      data.some((row) => row.offsets.some((offset) => Math.abs(offset) > 1))) {
    throw new Error(`${filename}: missing or unrevealed experience rows`);
  }
  await page.locator('#experience').screenshot({ path: `${output}/${filename}.png`, timeout: 60000 });
}

try {
  const en = await open('/', 1440, 900);
  if (!process.env.SKIP_EN_RECORD) await record(en.page, 'm-en-record', [0, 0.33, 0.66, 1]);
  await experience(en.page, 'm-en-experience', ['SFÉRA', 'FitUP!', 'Alza', 'Festival bar']);
  await en.context.close();

  const small = await open('/', 1280, 720);
  await record(small.page, 'm-en-720-record', [0.5]);
  await small.context.close();

  const sk = await open('/sk/', 1440, 900);
  await record(sk.page, 'm-sk-record', [0.5]);
  await experience(sk.page, 'm-sk-experience', ['SFÉRA', 'FitUP!', 'Alza', 'Festivalový bar']);
  await sk.context.close();

  const skSmall = await open('/sk/', 1280, 720);
  await record(skSmall.page, 'm-sk-720-record', [0.5]);
  await skSmall.context.close();

  const mobile = await open('/', 390, 844);
  await mobile.page.addStyleTag({ content: '#siteHeader,.skip-link{display:none!important}' });
  const panels = mobile.page.locator('.rec-panel');
  for (let i = 0; i < await panels.count(); i++) {
    await panels.nth(i).scrollIntoViewIfNeeded();
    await mobile.page.waitForTimeout(1200);
  }
  const mobileLayout = await mobile.page.locator('.rec-track').evaluate((el) => ({
    direction: getComputedStyle(el).flexDirection,
    count: el.children.length,
  }));
  if (mobileLayout.direction !== 'column' || mobileLayout.count !== 4) throw new Error('Mobile record is not stacked');
  await mobile.page.locator('#record').screenshot({ path: `${output}/m-en-390-record.png`, timeout: 60000 });
  console.log('mobile record:', mobileLayout);
  await mobile.context.close();

  const reduced = await open('/', 1440, 900, 'reduce');
  const reducedLayout = await reduced.page.locator('#record').evaluate((el) => ({
    static: el.classList.contains('rec-static'),
    direction: getComputedStyle(el.querySelector('.rec-track')).flexDirection,
    overflow: getComputedStyle(el.querySelector('.rec-bullets')).overflow,
  }));
  console.log('reduced record:', reducedLayout);
  if (!reducedLayout.static || reducedLayout.direction !== 'column' || reducedLayout.overflow !== 'visible') {
    throw new Error('Reduced-motion record is not stacked');
  }
  await reduced.context.close();
} finally {
  await browser.close();
}

if (errors.length) {
  console.error('Console errors:', [...new Set(errors)]);
  process.exitCode = 1;
} else {
  console.log('No console errors');
}
