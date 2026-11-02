import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  sessionStorage.setItem('ds-seen', '1');
  if (document.documentElement) document.documentElement.classList.add('no-gl');
  else new MutationObserver((_, observer) => {
    if (document.documentElement) {
      document.documentElement.classList.add('no-gl');
      observer.disconnect();
    }
  }).observe(document, { childList: true });
});
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#preloader', { state: 'detached', timeout: 15000 }).catch(() => {});
await page.addStyleTag({
  content: `
    #siteHeader, .hero-ticker, .hero-tags, .hero-ctas, .grain, .skip-link, astro-dev-toolbar { display: none !important; }
    .hero { min-height: 630px !important; }
    .hero-body { min-height: 630px !important; }
    .hero-photo-frame { top: 0 !important; bottom: 0 !important; }
    .hero-photo-frame { clip-path: none !important; }
    .mask-line > span { transform: none !important; }
    .line-wrap { overflow: visible !important; }
  `,
});
await page.waitForTimeout(800);
const fallback = await page.evaluate(() => ({
  noGl: document.documentElement.classList.contains('no-gl'),
  hasGl: document.querySelector('.hero').classList.contains('has-gl'),
  image: document.querySelector('.hero-photo-frame img').complete && document.querySelector('.hero-photo-frame img').naturalWidth > 0,
}));
if (!fallback.noGl || fallback.hasGl || !fallback.image) throw new Error(`OG hero fallback unavailable: ${JSON.stringify(fallback)}`);
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 85 });
await browser.close();
console.log('wrote public/og.jpg');
