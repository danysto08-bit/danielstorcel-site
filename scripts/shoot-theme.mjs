import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const failures = [], errors = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

async function open(width, height) {
  const mobile = width < 821;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  return { context, page };
}

async function scroll(page, selector, offset = 80) {
  const y = await page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await page.evaluate((value) => window.scrollTo(0, value), y + offset);
  await page.waitForTimeout(1800);
}

async function capture(page, name) {
  await page.screenshot({ path: `${out}/t-${name}.png`, timeout: 30000 });
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(width[0] === width[1], `${name}: width ${width}`);
}

async function color(page, label, selector) {
  const result = await page.evaluate((selector) => ({
    theme: document.body.dataset.theme,
    color: getComputedStyle(document.querySelector(selector)).color,
    body: getComputedStyle(document.body).color,
    background: getComputedStyle(document.body).backgroundColor,
  }), selector);
  console.log('contrast', label, result);
  check(result.theme === 'graphite' && result.color === 'rgb(243, 239, 231)' && result.body === result.color && result.background === 'rgb(20, 20, 24)', `${label}: ${JSON.stringify(result)}`);
}

async function skillProgress(page, progress) {
  const { top, distance } = await page.locator('#skills').evaluate((section) => ({
    top: section.getBoundingClientRect().top + scrollY,
    distance: section.offsetHeight - innerHeight,
  }));
  await page.evaluate((y) => window.scrollTo(0, y), top + progress * distance);
  await page.waitForTimeout(2000);
}

try {
  const en = await open(1440, 900);
  await scroll(en.page, '#about', 100);
  await color(en.page, 'about statement', '.about-statement');
  await capture(en.page, 'en-about');

  await scroll(en.page, '#work', 120);
  await en.page.locator('.work-item').nth(1).locator('.work-row').click();
  await en.page.mouse.move(1, 1);
  await en.page.waitForTimeout(1100);
  await scroll(en.page, '.work-item:nth-child(2) .w-tile', -300);
  await color(en.page, 'work description', '.work-item:nth-child(2) .w-desc');
  await capture(en.page, 'en-work-2');
  for (const index of [4, 5]) {
    const item = en.page.locator('.work-item').nth(index - 1);
    await item.locator('.work-row').click();
    await en.page.mouse.move(1, 1);
    await en.page.waitForTimeout(700);
    await scroll(en.page, `.work-item:nth-child(${index}) .w-tile`, -300);
    await en.page.waitForTimeout(1600);
    const pixels = await item.locator('canvas').evaluate((canvas) => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let light = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 20 && data[i] > 140 && data[i + 1] > 120 && data[i + 2] > 110) light++;
      return light;
    });
    console.log('canvas light pixels', index, pixels);
    check(pixels > 10, `work tile ${index} missing light canvas marks: ${pixels}`);
    await capture(en.page, `en-work-${index}`);
  }

  await skillProgress(en.page, 0);
  await color(en.page, 'skills word', '.skills-word:not(.is-near)');
  await capture(en.page, 'en-skills-000');
  await skillProgress(en.page, .2);
  const scrims = await en.page.evaluate(() => ({
    hud: getComputedStyle(document.querySelector('.skills-hud'), '::before').backgroundImage,
    chapters: getComputedStyle(document.querySelector('.skills-chapters'), '::before').backgroundImage,
  }));
  console.log('skills scrims', scrims);
  check(scrims.hud.includes('radial-gradient') && scrims.chapters.includes('linear-gradient'), `skills scrims ${JSON.stringify(scrims)}`);
  await capture(en.page, 'en-skills-200');
  await skillProgress(en.page, .5);
  await capture(en.page, 'en-skills-500');

  await scroll(en.page, '#experience', 100);
  await color(en.page, 'experience role', '.xp-role > span:last-child');
  await color(en.page, 'experience title', '.xp-name');
  await capture(en.page, 'en-experience');
  await en.page.keyboard.press('Tab');
  const chrome = await en.page.evaluate(() => {
    const role = document.querySelector('.xp-column');
    role.focus();
    const focus = getComputedStyle(role);
    const selection = getComputedStyle(document.body, '::selection');
    return {
      focusVisible: role.matches(':focus-visible'), focusColor: focus.outlineColor, focusWidth: focus.outlineWidth,
      selectionColor: selection.color, selectionBackground: selection.backgroundColor,
      themeColor: document.querySelector('meta[name="theme-color"]').content,
      og: document.querySelector('meta[property="og:image"]').content,
    };
  });
  console.log('chrome sanity', chrome);
  check(chrome.focusVisible && chrome.focusColor === 'rgb(255, 79, 31)' && chrome.focusWidth === '2px', `focus ${JSON.stringify(chrome)}`);
  check(chrome.selectionColor === 'rgb(26, 10, 4)' && chrome.selectionBackground === 'rgb(255, 79, 31)', `selection ${JSON.stringify(chrome)}`);
  check(chrome.themeColor === '#0c0c0d' && chrome.og.includes('og.jpg'), `metadata ${JSON.stringify(chrome)}`);
  await en.context.close();

  const mobile = await open(390, 844);
  await scroll(mobile.page, '#about', 80);
  await color(mobile.page, 'mobile about', '.about-statement');
  await capture(mobile.page, 'en-390-about');
  await scroll(mobile.page, '#work', 100);
  await scroll(mobile.page, '.work-item:first-child .w-tile', -200);
  await capture(mobile.page, 'en-390-work-1');
  await mobile.page.evaluate(() => document.querySelector('#burger').click());
  await mobile.page.waitForTimeout(800);
  const menu = await mobile.page.evaluate(() => ({
    expanded: document.querySelector('#burger').getAttribute('aria-expanded'),
    visibility: getComputedStyle(document.querySelector('#mobileMenu')).visibility,
    background: getComputedStyle(document.querySelector('#mobileMenu')).backgroundColor,
    color: getComputedStyle(document.querySelector('#mobileMenu')).color,
  }));
  console.log('mobile menu', menu);
  check(menu.expanded === 'true' && menu.visibility === 'visible' && menu.background === 'rgb(12, 12, 13)' && menu.color === 'rgb(243, 239, 231)', `menu ${JSON.stringify(menu)}`);
  await mobile.context.close();

  const preloader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  preloader.on('pageerror', (error) => errors.push(error.message));
  await preloader.goto(base, { waitUntil: 'domcontentloaded' });
  const pre = await preloader.evaluate(() => ({
    background: getComputedStyle(document.querySelector('.pl-panel')).backgroundColor,
    color: getComputedStyle(document.querySelector('#preloader')).color,
  }));
  console.log('preloader', pre);
  check(pre.background === 'rgb(12, 12, 13)' && pre.color === 'rgb(243, 239, 231)', `preloader ${JSON.stringify(pre)}`);
  await preloader.close();

  const notFound = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  notFound.on('pageerror', (error) => errors.push(error.message));
  const response = await notFound.goto(`${base}/404`, { waitUntil: 'domcontentloaded' });
  await notFound.evaluate(() => document.fonts.ready);
  const missing = await notFound.evaluate(() => ({
    title: document.querySelector('.nf-title')?.textContent,
    color: document.querySelector('.nf-title') && getComputedStyle(document.querySelector('.nf-title')).color,
    background: getComputedStyle(document.body).backgroundColor,
  }));
  console.log('404', response.status(), missing);
  check(missing.title?.includes('Not here') && missing.color === 'rgb(243, 239, 231)' && missing.background === 'rgb(12, 12, 13)', `404 ${JSON.stringify(missing)}`);
  await notFound.close();
} finally {
  await browser.close();
}
console.log('console errors', errors);
console.log('failures', failures);
if (errors.length || failures.length) process.exitCode = 1;
