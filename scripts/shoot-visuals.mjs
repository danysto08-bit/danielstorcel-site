import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (condition, description) => { if (!condition) failures.push(description); };
const shot = (page, name) => page.screenshot({ path: `${out}/q-${name}.png`, timeout: 30000 });
const top = (page, selector) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);
async function scroll(page, y, delay = 1700) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(delay);
}
async function open(path, width, height, reduced = false) {
  const mobile = width < 821;
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
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
async function width(page, label) {
  const result = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log('width', label, result);
  check(result[0] === result[1], `${label}: document width ${result[0]} != ${result[1]}`);
}
async function hero(page, label, capture = true) {
  if (capture) await shot(page, label);
  const result = await page.evaluate(() => {
    const frame = document.querySelector('.hero-photo-frame').getBoundingClientRect();
    const line = document.querySelector('.hero-name .line-2');
    const range = document.createRange();
    range.selectNodeContents(line);
    const glyph = range.getBoundingClientRect();
    return {
      gutter: document.querySelector('.hero-eyebrow').getBoundingClientRect().left,
      nameLeft: document.querySelector('.hero-name').getBoundingClientRect().left,
      glyphLeft: glyph.left, glyphRight: glyph.right, frameLeft: frame.left, frameRight: frame.right,
      frameWidth: frame.width, overlap: (glyph.right - frame.left) / frame.width,
      font: getComputedStyle(document.querySelector('.hero-name')).fontSize, viewport: innerWidth,
      gradient: getComputedStyle(document.querySelector('.hero-photo-frame'), '::after').backgroundImage,
    };
  });
  console.log('hero', label, result);
  check(Math.abs(result.gutter - result.nameLeft) < 1, `${label}: name not gutter aligned`);
  check(result.glyphLeft >= 0 && result.glyphRight <= result.viewport, `${label}: name clipped`);
  if (result.viewport >= 1024) {
    check(result.overlap >= 0.08 && result.overlap <= 0.12, `${label}: overlap ${(result.overlap * 100).toFixed(1)}%`);
    check(Math.abs(result.frameWidth / result.viewport - 0.66) < 0.01, `${label}: photo width`);
    check(result.gradient.includes('linear-gradient'), `${label}: gradient missing`);
  }
  await width(page, label);
}
async function ghosts(page, label) {
  const result = await page.evaluate(() => [...document.querySelectorAll('.ghost-index')].map((ghost) => {
    const section = ghost.closest('section');
    const container = section.id === 'research' ? ghost.closest('.research-copy') : section.querySelector(':scope > .wrap');
    const g = ghost.getBoundingClientRect(), r = container.getBoundingClientRect();
    const gutter = section.id === 'research' ? 0 : parseFloat(getComputedStyle(container).paddingRight);
    return { section: section.id, left: g.left, right: g.right, min: r.left + gutter, max: r.right - gutter };
  }));
  console.log('ghosts', label, JSON.stringify(result));
  result.forEach((g) => check(g.left >= g.min - 1 && Math.abs(g.right - g.max) <= 1, `${label}: ${g.section} ghost outside wrap`));
}
async function work(page) {
  for (let i = 0; i < 4; i++) {
    const item = page.locator('.work-item').nth(i);
    if (i > 0) {
      await scroll(page, await top(page, `.work-item:nth-child(${i + 1})`) - 180);
      await item.locator('.work-row').click();
      await page.waitForTimeout(1400);
    }
    await scroll(page, await top(page, `.work-item:nth-child(${i + 1})`) - 150, 1300);
    await page.mouse.move(4, 4);
    await page.waitForTimeout(550);
    if (i === 0) await item.locator('.tile-photo').evaluate((img) => img.decode());
    await shot(page, `en-work-open-${i + 1}`);
    const result = await item.evaluate((el) => {
      const tile = el.querySelector('.w-tile'), inner = el.querySelector('.w-tile-inner'), box = tile.getBoundingClientRect();
      const img = el.querySelector('.tile-photo');
      return {
        open: el.querySelector('button').getAttribute('aria-expanded'), width: box.width, height: box.height,
        background: getComputedStyle(inner).backgroundColor, clip: getComputedStyle(tile).clipPath,
        image: img ? { natural: img.naturalWidth, opacity: getComputedStyle(img).opacity, src: img.currentSrc } : null,
      };
    });
    console.log('work', i + 1, result);
    check(result.open === 'true' && result.width >= 288 && result.height >= 180 && Math.abs(result.width / result.height - 1.6) < .03, `work ${i + 1}: tile layout`);
    if (i === 0) check(result.image?.natural > 0 && result.image.opacity === '0.55' && result.image.src.includes('ach-foodathon'), 'work 1: photo');
    if (i === 1) check(result.background === 'rgb(255, 79, 31)', 'work 2: accent tile');
    if (i === 2) check(result.background === 'rgb(12, 12, 13)', 'work 3: ink tile');
    if (i === 3) check(result.background === 'rgb(5, 5, 6)', 'work 4: deep tile');
    await width(page, `en-work-open-${i + 1}`);
  }
}
async function experience(page) {
  await page.mouse.move(4, 4);
  await scroll(page, await top(page, '#experience') - 40, 2200);
  await shot(page, 'en-experience-rest');
  await page.locator('.xp-column').nth(1).hover();
  await page.waitForTimeout(700);
  await shot(page, 'en-experience-hover');
  const result = await page.evaluate(() => {
    const column = document.querySelectorAll('.xp-column')[1];
    const fill = document.querySelector('.xp-rail-fill');
    const dot = column.querySelector('.xp-node');
    return {
      columns: document.querySelectorAll('.xp-column').length,
      fill: new DOMMatrix(getComputedStyle(fill).transform).a,
      dot: Number(getComputedStyle(dot).scale),
      glow: getComputedStyle(dot).boxShadow,
      desc: getComputedStyle(column.querySelector('.xp-desc')).color,
      fg: getComputedStyle(document.body).getPropertyValue('--fg').trim(),
    };
  });
  console.log('experience hover', result);
  check(result.columns === 4 && result.fill > .1 && result.fill < .5 && result.dot > 1.5 && result.glow !== 'none', 'experience hover interaction');
  await page.mouse.move(4, 4);
  await page.locator('.xp-column').nth(1).focus();
  await page.waitForTimeout(650);
  const focusFill = await page.locator('.xp-rail-fill').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  check(focusFill > .1 && focusFill < .5, 'experience keyboard focus');
  await width(page, 'en-experience');
}
async function record(page, label, progress, capture = true) {
  const start = await page.locator('#record').evaluate((el) => {
    const pin = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return pin.getBoundingClientRect().top + scrollY;
  });
  const dist = await page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
  await scroll(page, start + dist * progress, 2300);
  await page.evaluate(async () => {
    const visible = [...document.querySelectorAll('.rec-photo img')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.right > 0 && r.left < innerWidth;
    });
    await Promise.all(visible.map((img) => img.decode()));
  });
  if (capture) await shot(page, label);
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.record-stage').getBoundingClientRect();
    const head = document.querySelector('.rec-head').getBoundingClientRect();
    return {
      stageTop: stage.top, stageBottom: stage.bottom, head: head.height,
      spacing: document.querySelector('.rec-head-top > div').textContent.trim().replace(/\s+/g, ' '),
      panels: [...document.querySelectorAll('.rec-panel')].map((panel) => {
        const ul = panel.querySelector('.rec-bullets');
        const frame = panel.querySelector('.rec-photo, .rec-poster');
        const ghost = panel.querySelector('.rec-ghost');
        return {
          fit: [ul.scrollHeight, ul.clientHeight], bottom: frame.getBoundingClientRect().bottom,
          color: getComputedStyle(ul.querySelector('li')).color, font: getComputedStyle(ul.querySelector('li')).fontSize,
          centered: panel.classList.contains('is-centered'), ghost: !!ghost,
          ghostX: ghost ? new DOMMatrix(getComputedStyle(ghost).transform).m41 : null,
        };
      }),
    };
  });
  console.log('record', label, JSON.stringify(result));
  check(Math.abs(result.stageTop) < 3 && result.head <= 190, `${label}: pin or header fit`);
  check(/08\s+—/.test(result.spacing), `${label}: header spacing`);
  check(result.panels.every((p) => p.fit[0] <= p.fit[1] + 1 && p.bottom <= result.stageBottom + 1 && p.font === '12.5px'), `${label}: bullet or frame fit`);
  check(result.panels.slice(0, 3).every((p) => p.ghost && Math.abs(p.ghostX) <= 30.1) && !result.panels[3].ghost, `${label}: ghost stats`);
  const centered = result.panels.filter((p) => p.centered);
  const sides = result.panels.filter((p) => !p.centered);
  if (centered.length && sides.length) check(centered[0].color !== sides[0].color, `${label}: centered bullet color`);
  await width(page, label);
}
async function research(page, label, capture = true) {
  await scroll(page, await top(page, '.research-pin') + 3, 2200);
  if (capture) await shot(page, label);
  const result = await page.evaluate(() => {
    const pin = document.querySelector('.research-pin').getBoundingClientRect();
    const copy = document.querySelector('.research-copy').getBoundingClientRect();
    return {
      pinTop: pin.top, height: copy.height, copyTop: copy.top, copyBottom: copy.bottom,
      gl: document.querySelector('#research').classList.contains('has-3d'),
      rows: [...document.querySelectorAll('.spec-row')].map((row) => ({
        label: row.querySelector('dt').textContent, value: row.querySelector('dd').textContent,
        opacity: getComputedStyle(row).opacity, transform: getComputedStyle(row.querySelector('dd')).textTransform,
      })),
    };
  });
  console.log('research', label, JSON.stringify(result));
  check(Math.abs(result.pinTop) < 3 && result.gl && result.rows.length === 5, `${label}: pin or spec card`);
  check(result.rows.every((r) => Number(r.opacity) > .99 && r.transform === 'none') && result.rows[2].value.includes('µm'), `${label}: spec reveal or values`);
  if (page.viewportSize().height === 720) check(result.height <= 640 && result.copyTop >= -1 && result.copyBottom <= 721, `${label}: copy does not fit 720px`);
  await width(page, label);
}
async function mobileExperience(page, label) {
  await scroll(page, await top(page, '#experience') - 30, 1800);
  await shot(page, label);
  const result = await page.evaluate(() => {
    const rail = document.querySelector('.xp-rail'), first = document.querySelector('.xp-desc');
    return {
      rail: [rail.getBoundingClientRect().width, rail.getBoundingClientRect().height],
      columns: document.querySelectorAll('.xp-column').length,
      color: getComputedStyle(first).color, fg: getComputedStyle(document.body).color,
      fill: getComputedStyle(document.querySelector('.xp-rail-fill')).display,
    };
  });
  console.log('static experience', label, result);
  check(result.rail[0] === 1 && result.rail[1] > 100 && result.columns === 4 && result.fill === 'none' && result.color === result.fg, `${label}: vertical timeline`);
  await width(page, label);
}

try {
  if (process.env.Q_FOCUS === 'hero-work') {
    const en = await open('/', 1440, 900);
    await hero(en.page, 'en-hero');
    await ghosts(en.page, 'en-1440');
    await scroll(en.page, await top(en.page, '#work') - 40, 1800);
    await en.page.locator('.tile-photo').first().evaluate((img) => img.decode());
    await shot(en.page, 'en-work-head');
    await work(en.page);
    await en.context.close();
    for (const [path, width, height, label, capture] of [
      ['/sk/', 1440, 900, 'sk-hero', true],
      ['/', 1280, 720, 'en-720-hero', false],
      ['/sk/', 1280, 720, 'sk-720-hero', false],
    ]) {
      const { context, page } = await open(path, width, height);
      await hero(page, label, capture);
      await context.close();
    }
  } else if (process.env.Q_FOCUS === 'research-experience') {
    const en = await open('/', 1440, 900);
    await ghosts(en.page, 'en-1440');
    await research(en.page, 'en-research-head');
    await experience(en.page);
    await en.context.close();
    const sk = await open('/sk/', 1440, 900);
    await ghosts(sk.page, 'sk-1440');
    await research(sk.page, 'sk-research-head');
    await sk.context.close();
    const en720 = await open('/', 1280, 720);
    await ghosts(en720.page, 'en-1280');
    await research(en720.page, 'en-720-research-head');
    await en720.context.close();
    const sk720 = await open('/sk/', 1280, 720);
    await ghosts(sk720.page, 'sk-1280');
    await research(sk720.page, 'sk-720-research-head', false);
    await sk720.context.close();
    for (const path of ['/', '/sk/']) {
      const { context, page } = await open(path, 390, 844);
      await ghosts(page, `${path}-390`);
      await width(page, `${path}-390`);
      await context.close();
    }
  } else {
  const en = await open('/', 1440, 900);
  await hero(en.page, 'en-hero');
  await ghosts(en.page, 'en-1440');
  await scroll(en.page, await top(en.page, '#work') - 40, 1800);
  await en.page.locator('.tile-photo').first().evaluate((img) => img.decode());
  await shot(en.page, 'en-work-head');
  await work(en.page);
  await experience(en.page);
  await record(en.page, 'en-record-33', .33);
  await record(en.page, 'en-record-66', .66);
  await research(en.page, 'en-research-head');
  await scroll(en.page, await top(en.page, '.summit-stage') + 900 * 3.2 * .25, 1500);
  const summit = await en.page.locator('.summit-stage').evaluate((el) => ({ top: el.getBoundingClientRect().top, gl: el.closest('#summit').classList.contains('has-3d') }));
  console.log('summit pin', summit);
  check(Math.abs(summit.top) < 3 && summit.gl, 'summit pin');
  await width(en.page, 'en-summit');
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  await hero(sk.page, 'sk-hero');
  await ghosts(sk.page, 'sk-1440');
  await record(sk.page, 'sk-record-33', .33, false);
  await research(sk.page, 'sk-research-head');
  await sk.context.close();

  const en720 = await open('/', 1280, 720);
  await hero(en720.page, 'en-720-hero', false);
  await ghosts(en720.page, 'en-1280');
  await record(en720.page, 'en-720-record-50', .5);
  await research(en720.page, 'en-720-research-head');
  await en720.context.close();
  const sk720 = await open('/sk/', 1280, 720);
  await hero(sk720.page, 'sk-720-hero', false);
  await ghosts(sk720.page, 'sk-1280');
  await record(sk720.page, 'sk-720-record-50', .5, false);
  await research(sk720.page, 'sk-720-research-head', false);
  await sk720.context.close();

  const mobile = await open('/', 390, 844);
  await hero(mobile.page, 'en-390-hero', false);
  await ghosts(mobile.page, 'en-390');
  await scroll(mobile.page, await top(mobile.page, '.rec-panel') - 70, 1800);
  await shot(mobile.page, 'en-390-record');
  await width(mobile.page, 'en-390-record');
  await scroll(mobile.page, await top(mobile.page, '.rec-photo') - 150, 1600);
  await mobile.page.locator('.rec-photo img').first().evaluate((img) => img.decode());
  await shot(mobile.page, 'en-390-record-photo');
  await scroll(mobile.page, await top(mobile.page, '.work-item:nth-child(2)') - 100, 1600);
  await mobile.page.locator('.work-row').nth(1).click();
  await mobile.page.waitForTimeout(1500);
  await scroll(mobile.page, await top(mobile.page, '.work-item:nth-child(2) .w-tile') - 500, 1300);
  await shot(mobile.page, 'en-390-work-open');
  const tile = await mobile.page.locator('.work-item').nth(1).locator('.w-tile').evaluate((el) => {
    const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
  });
  console.log('mobile tile', tile);
  check(Math.abs(tile.width / tile.height - 16 / 9) < .03, 'mobile tile ratio');
  await width(mobile.page, 'en-390-work-open');
  await mobileExperience(mobile.page, 'en-390-experience');
  await mobile.context.close();

  const skMobile = await open('/sk/', 390, 844);
  await hero(skMobile.page, 'sk-390-hero', false);
  await ghosts(skMobile.page, 'sk-390');
  for (const selector of ['#about', '#record', '#work', '#research', '#summit', '#skills', '#experience', '#contact']) {
    await scroll(skMobile.page, await top(skMobile.page, selector) + 80, 500);
    await width(skMobile.page, `sk-390-${selector}`);
  }
  await skMobile.context.close();

  const reduced = await open('/', 1440, 900, true);
  await mobileExperience(reduced.page, 'reduced-experience');
  await reduced.context.close();
  }
} finally {
  await browser.close();
}
if (errors.length) console.error('Console errors:', [...new Set(errors)]);
if (failures.length) console.error('Failures:', failures);
if (errors.length || failures.length) process.exitCode = 1;
else console.log('All checks passed; no console errors');
