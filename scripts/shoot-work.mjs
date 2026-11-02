import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

async function open(path, width, height, reduced = false) {
  const mobile = width < 821;
  const context = await browser.newContext({
    viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(`${path} ${width}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(`${path} ${width}: ${message.text()}`);
  });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  return { context, page };
}

async function scrollTo(page, locator, offset = 110) {
  const y = await locator.evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await page.evaluate((value) => scrollTo(0, value), y - offset);
  await page.waitForTimeout(1000);
}

async function inspect(page, index, previous, reduced, label) {
  const rows = page.locator('.work-item');
  const item = rows.nth(index - 1);
  if (await item.getAttribute('data-open') === null) await item.locator('.work-row').click();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(900);
  await scrollTo(page, item.locator('.w-tile'), 300);
  await page.waitForTimeout(3000);
  const result = await page.evaluate(({ index, previous, reduced }) => {
    const items = [...document.querySelectorAll('.work-item')];
    const current = items[index - 1], tile = current.querySelector('.w-tile');
    const canvas = tile.querySelector('canvas');
    let pixels = 0;
    if (canvas && reduced) {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i]) pixels++;
    }
    const edgeInk = canvas && index === 5 ? [.03, .97].map((fraction) => {
      const data = canvas.getContext('2d').getImageData(Math.floor(canvas.width * fraction), 0, 1, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] && (data[i] !== 5 || data[i + 1] !== 5 || data[i + 2] !== 6)) count++;
      }
      return count;
    }) : null;
    const tileRect = tile.getBoundingClientRect();
    const textBoxes = [...tile.querySelectorAll('.gry-title, .gry-count')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { class: el.className, left: (rect.left - tileRect.left) / tileRect.width, right: (rect.right - tileRect.left) / tileRect.width, top: (rect.top - tileRect.top) / tileRect.height, bottom: (rect.bottom - tileRect.top) / tileRect.height };
    });
    return {
      name: current.querySelector('.w-name').textContent, running: tile.dataset.running,
      previous: previous ? items[previous - 1].querySelector('.w-tile').dataset.running : null,
      width: document.documentElement.scrollWidth, viewport: innerWidth,
      tileWidth: tileRect.width, tileHeight: tileRect.height, edgeInk, textBoxes,
      canvasPixels: pixels, badge: tile.querySelector('.aim-badge') && getComputedStyle(tile.querySelector('.aim-badge')).opacity,
      copy: tile.textContent.trim(),
    };
  }, { index, previous, reduced });
  console.log(label, index, result);
  check(result.running === (reduced ? '0' : '1'), `${label} ${index}: running ${result.running}`);
  if (previous) check(result.previous === '0', `${label} ${index}: previous running ${result.previous}`);
  check(result.width === result.viewport, `${label} ${index}: width ${result.width}/${result.viewport}`);
  if (reduced && index === 2) check(result.badge === '1', `${label}: TORU final badge ${result.badge}`);
  if (reduced && index === 5) check(result.canvasPixels > 100, `${label}: mountain canvas empty ${result.canvasPixels}`);
  if (index === 5) check(result.edgeInk?.every((count) => count > 0), `${label}: mountain side bars ${result.edgeInk}`);
  if (index === 3) {
    check(result.textBoxes.length === 2, `${label}: missing Grynade text boxes`);
    result.textBoxes.forEach((box) => check(box.top >= .6 && box.bottom <= 1 && box.left >= 0 && box.right <= .65, `${label}: Grynade text outside safe area ${JSON.stringify(box)}`));
  }
  await page.screenshot({ path: `${out}/${label}-${index}.png`, timeout: 30000 });
}

try {
  const en = await open('/', 1440, 900);
  await scrollTo(en.page, en.page.locator('#work'), 20);
  await en.page.waitForTimeout(2500);
  await en.page.screenshot({ path: `${out}/x-en-work-head.png`, timeout: 30000 });
  const resting = await en.page.locator('.work-item').nth(2).locator('.w-name-ink').evaluate((el) => {
    const style = getComputedStyle(el);
    return { stroke: style.webkitTextStrokeWidth, backgroundPosition: style.backgroundPositionX };
  });
  console.log('resting name', resting);
  check(parseFloat(resting.stroke) === 0 && resting.backgroundPosition === '100%', `resting name ${JSON.stringify(resting)}`);
  console.log('score', await en.page.locator('.work-score-value').allTextContents());
  check(JSON.stringify(await en.page.locator('.work-score-value').allTextContents()) === JSON.stringify(['05', '01', '01', '10k']), 'score final values');
  await inspect(en.page, 1, null, false, 'x-en-work');
  await en.page.evaluate(() => scrollTo(0, 0));
  await en.page.waitForTimeout(1200);
  const offscreen = await en.page.locator('.work-item').first().locator('.w-tile').getAttribute('data-running');
  console.log('offscreen tile running', offscreen);
  check(offscreen === '0', `offscreen tile still running: ${offscreen}`);
  for (let i = 2; i <= 5; i++) await inspect(en.page, i, i - 1, false, 'x-en-work');
  await en.page.locator('.work-item').nth(2).locator('.work-row').hover();
  await en.page.waitForTimeout(150);
  const hoverPosition = await en.page.locator('.work-item').nth(2).locator('.w-name-ink').evaluate((el) => getComputedStyle(el).backgroundPositionX);
  console.log('hover background position', hoverPosition);
  check(parseFloat(hoverPosition) < 100, `hover sweep did not start: ${hoverPosition}`);
  await en.page.screenshot({ path: `${out}/x-en-work-hover.png`, timeout: 30000 });
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  await scrollTo(sk.page, sk.page.locator('#work'), 20);
  await sk.page.waitForTimeout(2200);
  await inspect(sk.page, 2, 1, false, 'x-sk-work');
  await inspect(sk.page, 4, 2, false, 'x-sk-work');
  await sk.context.close();

  const small = await open('/', 1280, 720);
  await scrollTo(small.page, small.page.locator('#work'), 20);
  await small.page.waitForTimeout(2200);
  await inspect(small.page, 3, 1, false, 'x-en-720-work');
  await small.context.close();

  const mobile = await open('/', 390, 844);
  await scrollTo(mobile.page, mobile.page.locator('#work'), 20);
  await mobile.page.waitForTimeout(2200);
  await inspect(mobile.page, 1, null, false, 'x-en-390-work');
  await inspect(mobile.page, 2, 1, false, 'x-en-390-work');
  await mobile.context.close();

  const reduced = await open('/', 1440, 900, true);
  await scrollTo(reduced.page, reduced.page.locator('#work'), 20);
  await inspect(reduced.page, 2, 1, true, 'x-reduced-work');
  await inspect(reduced.page, 5, 2, true, 'x-reduced-work');
  await reduced.context.close();
} finally {
  await browser.close();
}
console.log('console errors', errors);
console.log('failures', failures);
if (errors.length || failures.length) process.exitCode = 1;
