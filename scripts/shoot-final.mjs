import { chromium } from 'playwright';
import { copyFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (ok, description) => { if (!ok) failures.push(description); };
const shot = (page, name, options = {}) => page.screenshot({ path: `${out}/r-${name}.png`, timeout: 30000, ...options });
const top = (page, selector) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);
async function scroll(page, y, delay = 1600) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(delay);
}
async function fullPage(page) {
  const { width: viewportWidth, height: viewportHeight } = page.viewportSize();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const slices = [];
  let hidden;
  for (let y = 0; y < height; y += viewportHeight) {
    await scroll(page, y, 500);
    const actual = await page.evaluate(() => scrollY);
    const sliceHeight = Math.min(viewportHeight, height - y);
    const image = await page.screenshot({ timeout: 30000 });
    const cropped = await sharp(image).extract({
      left: 0, top: Math.round(y - actual), width: viewportWidth, height: sliceHeight,
    }).png().toBuffer();
    slices.push({ input: cropped, left: 0, top: y });
    if (!hidden) hidden = await page.addStyleTag({
      content: '#siteHeader, #scrollProgress, #themeScan, .cursor { visibility: hidden !important }',
    });
  }
  await sharp({
    create: { width: viewportWidth, height, channels: 4, background: '#0c0c0d' },
  }).composite(slices).png().toFile(`${out}/r-en-full.png`);
  await hidden?.evaluate((style) => style.remove());
}
async function open(base, path, width, height, reduced = false) {
  const mobile = width < 821;
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', (e) => errors.push(`${base}${path} ${width}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || /GL_INVALID/.test(m.text())) errors.push(`${base}${path} ${width}: ${m.text()}`);
  });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('.hero.has-gl', { timeout: 30000 });
  await page.waitForTimeout(2200);
  return { context, page };
}
async function width(page, label) {
  const result = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log('width', label, result);
  check(result[0] === result[1], `${label}: width ${result}`);
}
async function hero(page, label, capture = false) {
  if (capture) await shot(page, label);
  const data = await page.evaluate(() => {
    const line = document.querySelector('.hero-name .line-2'), range = document.createRange();
    range.selectNodeContents(line);
    const glyph = range.getBoundingClientRect(), frame = document.querySelector('.hero-photo-frame').getBoundingClientRect();
    return {
      left: document.querySelector('.hero-name').getBoundingClientRect().left,
      gutter: document.querySelector('.hero-eyebrow').getBoundingClientRect().left,
      right: glyph.right, frameLeft: frame.left, frameWidth: frame.width, viewport: innerWidth,
      overlap: (glyph.right - frame.left) / frame.width,
    };
  });
  console.log('hero', label, data);
  check(Math.abs(data.left - data.gutter) < 1 && data.right <= data.viewport, `${label}: hero alignment`);
  if (data.viewport >= 1024) check(data.overlap >= .08 && data.overlap <= .12 && Math.abs(data.frameWidth / data.viewport - .66) < .01, `${label}: hero overlap`);
  await width(page, label);
}
async function pin(page, selector, fraction, distance) {
  const start = await page.locator(selector).evaluate((el) => {
    const pin = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    return pin.getBoundingClientRect().top + scrollY;
  });
  await scroll(page, start + distance * fraction, 2200);
  if (selector === '#record') {
    await page.evaluate(async () => {
      const visible = [...document.querySelectorAll('.rec-photo img')].filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.right > 0 && rect.left < innerWidth;
      });
      await Promise.all(visible.map((img) => img.decode()));
    });
  }
  const pinTop = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
  check(Math.abs(pinTop) < 3, `${selector}: pin top ${pinTop}`);
}
async function skills(page, label, desktop, capture = true) {
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const start = await top(page, '#skills');
  const height = await page.locator('#skills').evaluate((el) => el.offsetHeight);
  await scroll(page, start + (reduced ? 100 : .5 * (height - page.viewportSize().height)), 2200);
  if (capture) await shot(page, label);
  const result = await page.evaluate(() => {
    const section = document.querySelector('#skills');
    const words = [...section.querySelectorAll('.skills-word')];
    return {
      fly: section.classList.contains('has-fly'), words: words.length,
      visible: words.filter((word) => getComputedStyle(word).visibility !== 'hidden' && +getComputedStyle(word).opacity > .05).length,
      counter: section.querySelector('.skills-counter').textContent,
      stage: getComputedStyle(section.querySelector('.skills-stage')).display,
      list: getComputedStyle(section.querySelector('.skills-list')).display,
      listItems: section.querySelectorAll('.skills-list li').length,
      accessibleItems: section.querySelectorAll('.skills-accessible li').length,
      height: section.offsetHeight,
    };
  });
  console.log('skills', label, result);
  if (reduced) check(!result.fly && result.list !== 'none' && result.stage === 'none' && result.listItems === 100 && result.height < 3000, `${label}: reduced list ${JSON.stringify(result)}`);
  else {
    check(result.fly && result.words === 100 && result.stage !== 'none' && result.list === 'none' && result.accessibleItems === 100, `${label}: fly-through ${JSON.stringify(result)}`);
    if (desktop) check(result.visible >= 6 && result.visible <= 30 && result.counter === '051', `${label}: midpoint ${JSON.stringify(result)}`);
  }
  await width(page, label);
}
async function contact(page, label, wave) {
  await scroll(page, await top(page, '#contact') + 100, 2300);
  if (wave) await page.waitForSelector('.contact-headline.is-revealed', { timeout: 15000 });
  await shot(page, label);
  const clock = await page.locator('#localTime').evaluate((el) => ({
    label: el.getAttribute('aria-label'), seconds: el.querySelectorAll('.clock-seconds-roll span').length,
  }));
  console.log('contact', label, clock);
  check(/^\d\d:\d\d:\d\d$/.test(clock.label || '') && clock.seconds === 2, `${label}: clock`);
  const detail = await page.locator('#contact').evaluate((section) => ({
    planks: section.querySelectorAll('.plank').length,
    first: section.querySelector('.plank')?.id,
    home: section.querySelector('.plank.is-home .home-clock')?.textContent,
    instagram: section.querySelector('.plank[data-id="instagram"]')?.getAttribute('href'),
    links: section.querySelectorAll('.footer-sitemap a').length,
    bounds: [...section.querySelectorAll('.plank')].map((plank) => {
      const rect = plank.getBoundingClientRect();
      return { id: plank.dataset.id, left: rect.left, right: rect.right };
    }),
    viewport: innerWidth,
  }));
  console.log('signpost', label, detail);
  check(detail.planks === 11 && detail.first === 'emailLink' && /^\d\d:\d\d$/.test(detail.home || '') && detail.home === clock.label?.slice(0, 5) && detail.links === 8 && detail.instagram === 'https://www.instagram.com/daniel._kooo', `${label}: signpost ${JSON.stringify(detail)}`);
  check(detail.bounds.every(({ left, right }) => left >= 0 && right <= detail.viewport), `${label}: plank overflow ${JSON.stringify(detail.bounds)}`);
  const email = page.locator('#emailLink'), emailText = email.locator('.email-flip');
  const address = await email.getAttribute('data-email'), copied = await email.getAttribute('data-copied');
  await email.click();
  await page.waitForTimeout(300);
  check(await emailText.textContent() === copied, `${label}: copied state`);
  await page.waitForTimeout(1300);
  check(await emailText.textContent() === address, `${label}: email restored`);
  if (wave) {
    const chars = page.locator('.contact-headline .mask-line').first().locator(':scope > span > div');
    check(await chars.count() > 5, `${label}: chars`);
    await chars.nth(5).hover({ force: true });
    await page.waitForTimeout(350);
    await shot(page, 'en-contact-hover');
    const transforms = await chars.evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
    check(transforms.some((t) => t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)'), `${label}: wave`);
    const place = page.locator('.plank[data-id="matterhorn"]');
    await place.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    const before = await place.evaluate((el) => getComputedStyle(el).transform);
    await place.hover();
    await page.waitForTimeout(500);
    const after = await place.evaluate((el) => getComputedStyle(el).transform);
    check(before !== after, `${label}: hover transform ${before} → ${after}`);
  }
  await width(page, label);
}
async function summit(page, viewportWidth, height) {
  const fractions = [.4, .75, 1];
  for (const fraction of fractions) {
    await pin(page, '.summit-stage', fraction, 3.8 * height);
    await page.evaluate(async () => {
      const visible = [...document.querySelectorAll('.stack-photo img')].filter((img) =>
        getComputedStyle(img.closest('.stack-photo')).display !== 'none');
      await Promise.all(visible.map((img) => { img.loading = 'eager'; return img.decode(); }));
    });
    const name = String(Math.round(fraction * 100));
    await shot(page, `en-summit-${name}`);
    const result = await page.locator('#terrainCanvas').evaluate((el) => ({
      calls: Number(el.dataset.drawCalls), visible: getComputedStyle(el).display !== 'none',
    }));
    console.log('summit', name, result);
    check(result.visible && result.calls > 0 && result.calls < 260, `summit ${name}: draw calls`);
  }
  await width(page, `summit-${viewportWidth}`);
}
const dev = process.env.BASE_URL || 'http://127.0.0.1:4321';
const preview = process.env.PREVIEW_URL || 'http://127.0.0.1:4322';
try {
  if (process.env.FOCUS === 'hero-pins') {
    for (const path of ['/', '/sk/']) {
      const { context, page } = await open(dev, path, 1440, 900);
      await hero(page, path === '/' ? 'en-hero' : 'sk-hero', path === '/');
      if (path === '/') {
        const image = await sharp(`${out}/r-en-hero.png`).extract({ left: 1000, top: 250, width: 250, height: 350 }).stats();
        const contrast = image.channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
        console.log('hero photo contrast', contrast);
        check(contrast > 5, 'hero photo blank');
      }
      const distance = await page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
      await pin(page, '#record', .33, distance);
      if (path === '/') await shot(page, 'en-pins-record');
      await page.waitForSelector('#research.has-3d');
      await pin(page, '.research-pin', .48, 3.4 * 900);
      if (path === '/') await shot(page, 'en-pins-research');
      await pin(page, '.summit-stage', .75, 3.8 * 900);
      const ancestors = await page.evaluate(() => ['#record', '.research-pin', '.summit-stage'].map((selector) => {
        const bad = [];
        for (let el = document.querySelector(selector).parentElement; el; el = el.parentElement) {
          if (getComputedStyle(el).transform !== 'none') bad.push(el.className || el.tagName);
        }
        return { selector, bad };
      }));
      console.log('pinned ancestors', path, ancestors);
      check(ancestors.every((entry) => entry.bad.length === 0), `${path}: transformed pin ancestor`);
      await context.close();
    }
    for (const path of ['/', '/sk/']) {
      const { context, page } = await open(dev, path, 1280, 720);
      await hero(page, `${path}-720-hero`);
      await context.close();
    }
  } else if (process.env.FOCUS === 'changed') {
    const en = await open(dev, '/', 1440, 900);
    await summit(en.page, 1440, 900);
    await skills(en.page, 'en-skills-enter', true);
    const themes = [];
    for (const [selector, expected] of [
      ['.hero','ink'], ['#about','graphite'], ['#record','ink'], ['#work','graphite'],
      ['#research','ink'], ['#summit','deep'], ['#skills','graphite'], ['#experience','graphite'], ['#contact','accent'],
      ['#experience','graphite'], ['#skills','graphite'], ['#summit','deep'], ['#research','ink'],
      ['#work','graphite'], ['#record','ink'], ['#about','graphite'], ['.hero','ink'],
    ]) {
      await scroll(en.page, Math.max(0, await top(en.page, selector) + 80), 700);
      const actual = await en.page.evaluate(() => document.body.dataset.theme || 'ink');
      themes.push(`${selector}:${actual}`);
      check(actual === expected, `theme ${selector}: ${actual} != ${expected}`);
    }
    console.log('themes', themes);
    await fullPage(en.page);
    await en.context.close();

    const sk = await open(dev, '/sk/', 1440, 900);
    for (const fraction of [.4, .75, 1]) {
      await pin(sk.page, '.summit-stage', fraction, 3.8 * 900);
      const calls = Number(await sk.page.locator('#terrainCanvas').getAttribute('data-draw-calls'));
      console.log('sk summit', fraction, calls);
      check(calls > 0 && calls < 260, `sk summit ${fraction}: draw calls`);
    }
    await skills(sk.page, 'sk-skills', true, false);
    await sk.context.close();

    const en720 = await open(dev, '/', 1280, 720);
    await skills(en720.page, 'en-720-skills', true);
    await en720.context.close();

    for (const path of ['/', '/sk/']) {
      const mobile = await open(dev, path, 390, 844);
      await scroll(mobile.page, await top(mobile.page, '#contact') + 100, 2000);
      if (path === '/') await shot(mobile.page, 'en-390-contact');
      const geometry = await mobile.page.evaluate(() => {
        const first = document.querySelector('.contact-headline .mask-line > span');
        const chars = [...first.children].filter((char) => char.textContent.trim());
        const boxes = chars.map((char) => char.getBoundingClientRect());
        return {
          topSpread: Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top)),
          right: Math.max(...boxes.map((box) => box.right)), viewport: innerWidth,
        };
      });
      console.log('mobile contact', path, geometry);
      check(geometry.topSpread < 2 && geometry.right <= geometry.viewport, `${path}: mobile contact headline wraps or clips`);
      await width(mobile.page, `${path}-390-contact`);
      await mobile.context.close();
    }

    for (const path of ['/', '/sk/']) {
      const { context, page } = await open(preview, path, 1440, 900);
      await pin(page, '.summit-stage', .75, 3.8 * 900);
      const calls = Number(await page.locator('#terrainCanvas').getAttribute('data-draw-calls'));
      console.log('preview summit', path, calls);
      check(calls > 0 && calls < 260, `preview ${path}: summit draw calls`);
      await skills(page, `preview-${path}-skills`, true, false);
      await scroll(page, await top(page, '#contact') + 100, 1200);
      await width(page, `preview-${path}`);
      await context.close();
    }
  } else {
  const en = await open(dev, '/', 1440, 900);
  if (!process.env.SKIP_EARLY) {
    await hero(en.page, 'en-hero', true);
    const recordDistance = await en.page.locator('.rec-track').evaluate((el) => Math.max(0, el.scrollWidth - innerWidth + 64));
    await pin(en.page, '#record', .33, recordDistance);
    await shot(en.page, 'en-pins-record');
    const researchDistance = 3.4 * 900;
    await pin(en.page, '.research-pin', .48, researchDistance);
    await shot(en.page, 'en-pins-research');
    await summit(en.page, 1440, 900);
  }
  await skills(en.page, 'en-skills-enter', true);
  await contact(en.page, 'en-contact-rest', true);
  const themes = [];
  for (const [selector, expected] of [['.hero','ink'],['#about','graphite'],['#record','ink'],['#work','graphite'],['#research','ink'],['#summit','deep'],['#skills','graphite'],['#experience','graphite'],['#contact','accent']]) {
    await scroll(en.page, Math.max(0, await top(en.page, selector) + 80), 700);
    const actual = await en.page.evaluate(() => document.body.dataset.theme || 'ink');
    themes.push(`${selector}:${actual}`);
    check(actual === expected, `theme down ${selector}: ${actual} != ${expected}`);
  }
  for (const [selector, expected] of [['#experience','graphite'],['#skills','graphite'],['#summit','deep'],['#research','ink'],['#work','graphite'],['#record','ink'],['#about','graphite'],['.hero','ink']]) {
    await scroll(en.page, Math.max(0, await top(en.page, selector) + 80), 700);
    const actual = await en.page.evaluate(() => document.body.dataset.theme || 'ink');
    themes.push(`${selector}:${actual}`);
    check(actual === expected, `theme up ${selector}: ${actual} != ${expected}`);
  }
  console.log('themes', themes);
  await fullPage(en.page);
  await en.context.close();

  for (const [path, w, h, label] of [['/sk/',1440,900,'sk-1440'],['/',1280,720,'en-720'],['/sk/',1280,720,'sk-720'],['/',390,844,'en-390'],['/sk/',390,844,'sk-390']]) {
    const { context, page } = await open(dev, path, w, h);
    await hero(page, label);
    if (label === 'en-720') await skills(page, 'en-720-skills', true);
    if (label === 'en-390') {
      await skills(page, 'en-390-skills', false);
      await contact(page, 'en-390-contact', false);
      await scroll(page, await top(page, '.summit-stage') - 40, 1800);
      await shot(page, 'en-390-summit');
    }
    await width(page, label);
    await context.close();
  }
  const reduced = await open(dev, '/', 1440, 900, true);
  await skills(reduced.page, 'reduced-skills', false);
  await contact(reduced.page, 'reduced-contact', false);
  await scroll(reduced.page, await top(reduced.page, '.summit-stage') - 40, 1800);
  await shot(reduced.page, 'reduced-summit');
  await reduced.context.close();
  await copyFile('public/og.jpg', `${out}/r-og.jpg`);

  for (const path of ['/', '/sk/']) {
    const { context, page } = await open(preview, path, 1440, 900);
    for (const selector of ['#record', '#research', '#summit', '#skills', '#contact']) {
      await scroll(page, await top(page, selector) + 80, 800);
    }
    await width(page, `preview-${path}`);
    await context.close();
  }
  }
} finally {
  await browser.close();
}
if (errors.length) console.error('Console errors:', [...new Set(errors)]);
if (failures.length) console.error('Failures:', failures);
if (errors.length || failures.length) process.exitCode = 1;
else console.log('All checks passed; no console errors');
