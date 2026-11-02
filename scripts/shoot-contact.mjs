import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const out = '/tmp/ds-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const errors = [], failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const shot = (page, name) => page.screenshot({ path: `${out}/c4-${name}.png`, timeout: 30000 });

async function open(path, width, height, reduced = false, blocked = false) {
  const mobile = width < 821;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(`${path} ${width}: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' || /GL_INVALID/.test(message.text())) errors.push(`${path} ${width}: ${message.text()}`); });
  if (blocked) await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 500, body: '' }));
  await page.addInitScript(() => sessionStorage.setItem('ds-seen', '1'));
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  return { context, page };
}

async function scrollTo(page, selector, offset = 80, wait = 2600) {
  const top = await page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().top + scrollY);
  await page.evaluate((y) => scrollTo(0, y), top + offset);
  await page.waitForTimeout(wait);
}

async function inspect(page, label) {
  const result = await page.locator('#contact').evaluate((section) => {
    const planks = [...section.querySelectorAll('.plank')], clock = section.querySelector('#localTime');
    return {
      theme: document.body.dataset.theme,
      ids: planks.map((plank) => plank.dataset.id),
      first: planks[0]?.id,
      home: section.querySelector('.plank.is-home .home-clock')?.textContent,
      clock: clock?.getAttribute('aria-label'),
      instagram: section.querySelector('.plank[data-id="instagram"]')?.getAttribute('href'),
      cv: section.querySelector('.plank[data-id="cv"]')?.getAttribute('href'),
      links: section.querySelectorAll('.footer-sitemap a').length,
      bearing: section.querySelector('.plank[data-id="gerlach"] .plank-meta')?.textContent,
      mark: section.querySelector('.plank[data-id="traunstein"] .plank-tag')?.textContent,
      bounds: planks.map((plank) => {
        const rect = plank.getBoundingClientRect();
        return { id: plank.dataset.id, left: rect.left, right: rect.right, width: plank.clientWidth, scrollWidth: plank.scrollWidth, overflowing: [...plank.children].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className) };
      }),
      weather: { hidden: section.querySelector('.contact-weather')?.hidden, state: section.querySelector('.contact-weather')?.dataset.state, text: section.querySelector('.contact-weather')?.textContent },
      width: document.documentElement.scrollWidth, viewport: innerWidth,
    };
  });
  console.log(label, result);
  check(result.theme === 'accent' && result.ids.join(',') === 'email,instagram,cv,chamonix,matterhorn,monterosa,traunstein,vienna,bratislava,palermo,gerlach' && result.first === 'emailLink', `${label}: plank content ${JSON.stringify(result)}`);
  check(result.instagram === 'https://www.instagram.com/daniel._kooo' && result.cv?.endsWith('.pdf') && result.links === 8, `${label}: links ${JSON.stringify(result)}`);
  check(result.bearing === 'NE 64.8° · 1 062 km' && result.mark?.includes('✓'), `${label}: location ${JSON.stringify(result)}`);
  check(/^\d\d:\d\d:\d\d$/.test(result.clock || '') && result.home === result.clock?.slice(0, 5), `${label}: clocks ${JSON.stringify(result)}`);
  check(result.width === result.viewport && result.bounds.every(({ left, right, width, scrollWidth, overflowing }) => left >= 0 && right <= result.viewport && scrollWidth <= width + 1 && !overflowing.length), `${label}: overflow ${JSON.stringify(result.bounds)}`);
  return result;
}

async function copyEmail(page) {
  const email = page.locator('#emailLink'), text = email.locator('.email-flip');
  const address = await email.getAttribute('data-email'), copied = await email.getAttribute('data-copied');
  await email.click();
  await page.waitForTimeout(300);
  const flipped = await text.textContent();
  await page.waitForTimeout(1300);
  const restored = await text.textContent();
  console.log('email flip', flipped, restored);
  check(flipped === copied && restored === address, `copy flip ${flipped} → ${restored}`);
}

async function hoverPlace(page) {
  const place = page.locator('.plank[data-id="matterhorn"]');
  await place.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500);
  const before = await place.evaluate((element) => getComputedStyle(element).transform);
  await place.hover();
  await page.waitForTimeout(500);
  const after = await place.evaluate((element) => getComputedStyle(element).transform);
  console.log('hover', before, after);
  check(before !== after, `place hover ${before} → ${after}`);
}

try {
  const en = await open('/', 1440, 900);
  await scrollTo(en.page, '#contact', 80, 500);
  await shot(en.page, 'en-contact-enter');
  await en.page.waitForTimeout(2600);
  await en.page.waitForSelector('.contact-headline.is-revealed');
  await inspect(en.page, 'EN desktop');
  await shot(en.page, 'en-contact-rest');
  await hoverPlace(en.page);
  await shot(en.page, 'en-contact-hover');
  await copyEmail(en.page);
  await en.context.close();

  const sk = await open('/sk/', 1440, 900);
  await scrollTo(sk.page, '#contact');
  await inspect(sk.page, 'SK desktop');
  await shot(sk.page, 'sk-contact-rest');
  await sk.context.close();

  const small = await open('/', 1280, 720);
  await scrollTo(small.page, '#contact');
  await inspect(small.page, 'EN 720');
  await shot(small.page, 'en-720-contact');
  await small.context.close();

  const narrow = await open('/', 1024, 768);
  await scrollTo(narrow.page, '#contact');
  await inspect(narrow.page, 'EN 1024');
  await narrow.context.close();

  const mobile = await open('/', 390, 844);
  await scrollTo(mobile.page, '#contact');
  await inspect(mobile.page, 'EN mobile');
  await shot(mobile.page, 'en-390-contact-a');
  await scrollTo(mobile.page, '.plank[data-id="bratislava"]', -150);
  await shot(mobile.page, 'en-390-contact-b');
  await mobile.context.close();

  const tiny = await open('/sk/', 320, 800);
  await scrollTo(tiny.page, '#contact');
  await inspect(tiny.page, 'SK 320');
  await tiny.context.close();

  const reduced = await open('/', 1440, 900, true);
  await scrollTo(reduced.page, '#contact');
  await inspect(reduced.page, 'EN reduced');
  const sway = await reduced.page.locator('.signpost').evaluate((element) => getComputedStyle(element).getPropertyValue('--sway').trim());
  check(sway === '0deg', `reduced sway ${sway}`);
  await shot(reduced.page, 'reduced-contact');
  await reduced.context.close();

  const blocked = await open('/', 1440, 900, false, true);
  await scrollTo(blocked.page, '#contact');
  const weather = await blocked.page.locator('.contact-weather').evaluate((el) => ({ hidden: el.hidden, state: el.dataset.state }));
  console.log('500 weather', weather);
  check(weather.hidden && weather.state === 'unavailable', `500 weather ${JSON.stringify(weather)}`);
  await blocked.context.close();
} finally {
  await browser.close();
}
console.log('console errors', errors);
console.log('failures', failures);
if (errors.length || failures.length) process.exitCode = 1;
