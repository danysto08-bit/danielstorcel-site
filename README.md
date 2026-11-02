# danielstorcel-v2

Personal site for Daniel Štorcel — "alpine editorial" redesign. Astro 7 static site, EN + SK routes, GSAP/Lenis motion.

## Stack

- **Astro 7.4.2** (`output: 'static'`), `@astrojs/sitemap`, strict TS
- **GSAP 3.15** (ScrollTrigger + SplitText) + **Lenis** smooth scroll
- Fonts via Astro Fonts API: Instrument Serif (display), Geist (sans), JetBrains Mono
- Images via `astro:assets` `<Picture>` (avif/webp), photos in `src/assets/`
- No React, no Tailwind — scoped Astro styles + `src/styles/global.css` tokens

## Commands

```bash
npm i
npm run dev      # dev server (127.0.0.1:4321)
npm run build    # static build → dist/
npm run check    # astro check (types + a11y diagnostics)
npm run og       # regenerate public/og.jpg (needs dev server running)
npm run shoot    # screenshot matrix → /tmp/ds-shots (needs dev server running)
```

Node ≥ 22 required (`engines`).

## Content

All copy lives in **`src/content/site.ts`** — a typed `content: Record<'en'|'sk', SiteContent>`.
To add or edit a string, add it to the `SiteContent` interface and to **both** `content.en` and `content.sk`. Inline `<b>` tags in paragraph strings are preserved and rendered via `set:html`. Routes: `src/pages/index.astro` (EN, `/`) and `src/pages/sk/index.astro` (SK, `/sk/`).

Photos: `src/assets/` (imported and optimized). CV PDFs, favicon, robots.txt: `public/`.

## Motion

`src/scripts/motion.ts` — Lenis↔GSAP setup. `src/scripts/main.ts` — orchestration (preloader, theme morph, header, contact). `src/scripts/sections/*.ts` — per-section animations, all inside `gsap.matchMedia()` contexts (`prefers-reduced-motion` gets final states). Everything is also readable without JS (noscript overrides + `.js`-gated hiding).

## Deploy (Vercel)

- Framework preset: **Astro**
- Build: `npm run build`, output `dist`
- Before deploy, set `site` in `astro.config.mjs` to the final domain (canonicals, hreflang, sitemap and robots.txt derive from it).
