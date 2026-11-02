import { gsap, ScrollTrigger, SplitText, initMotion } from './motion';
import { initMagnetic } from './magnetic';
import { initRecord } from './sections/record';
import { initWork } from './sections/work';
import { initResearch } from './sections/research';
import { initResearchCopy } from './sections/research-copy';
import { initSummit } from './sections/summit';
import { initSkills } from './sections/skills';
import { initExperience } from './sections/experience';
import { initContactScene } from './sections/contact';
import { createDigitRoll } from './ui/digits';
import type { HeroGL } from './hero-gl';

const { lenis, isReduced } = initMotion();

if (isReduced) document.documentElement.classList.add('no-motion');
let heroGL: HeroGL | null = null;
let heroScroll = 0;
let heroStarted = false;
const heroReveal = { value: isReduced ? 1 : 0 };

/* ---------- Theme morph: body data-theme follows the section in view ---------- */
function initThemeMorph() {
  const sections = document.querySelectorAll<HTMLElement>('[data-theme]');
  const scan = document.getElementById('themeScan');
  const set = (v: string) => {
    if ((document.body.dataset.theme || 'ink') === v) return;
    if (v === 'ink') delete document.body.dataset.theme;
    else document.body.dataset.theme = v;
    if (scan && !isReduced) gsap.fromTo(scan, { y: 0, opacity: 0.6 }, {
      y: window.innerHeight, opacity: 0, duration: 0.6, ease: 'none', overwrite: true,
    });
  };
  sections.forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      // if the section is pinned, span the whole pin-spacer, not just the element box
      end: () => {
        // sections pinned on themselves need the pin distance included in the theme span
        const pin = ScrollTrigger.getAll().find((st) => st.pin && st.trigger === sec);
        const extra = pin ? pin.end - pin.start : 0;
        return '+=' + (sec.offsetHeight + extra);
      },
      refreshPriority: -1,
      onToggle: (self) => self.isActive && set(sec.dataset.theme!),
    });
  });
}

/* ---------- Preloader ---------- */
function runPreloader(onDone: () => void) {
  const pre = document.getElementById('preloader');
  if (!pre) return onDone();
  const seen = sessionStorage.getItem('ds-seen');
  if (isReduced || seen) {
    pre.remove();
    onDone();
    return;
  }
  const counter = pre.querySelector<HTMLElement>('.pl-count')!;
  const name = pre.querySelector<HTMLElement>('.pl-name')!;
  const rule = pre.querySelector<HTMLElement>('.pl-rule')!;
  const top = pre.querySelector<HTMLElement>('.pl-panel.top')!;
  const bottom = pre.querySelector<HTMLElement>('.pl-panel.bottom')!;
  const bounds = name.getBoundingClientRect();
  pre.style.setProperty('--split', `${bounds.top + bounds.height / 2}px`);
  document.body.style.overflow = 'hidden';

  const tl = gsap.timeline({
    onComplete: () => {
      pre.remove();
      document.body.style.overflow = '';
      sessionStorage.setItem('ds-seen', '1');
      ScrollTrigger.refresh();
    },
  });

  const num = { v: 0 };
  tl.to(num, {
    v: 100,
    duration: 1.05,
    ease: 'power3.inOut',
    onUpdate: () => (counter.textContent = String(Math.round(num.v)).padStart(3, '0')),
  }, 0);
  tl.from(name.querySelectorAll('.pl-word'), {
    yPercent: 110,
    duration: 0.85,
    ease: 'expo.out',
    stagger: 0.12,
  }, 0.12);
  tl.to(rule, { scaleX: 1, duration: 1.05, ease: 'power3.inOut' }, 0);
  tl.to([name, counter], { scale: 0.6, opacity: 0, duration: 0.7, ease: 'expo.inOut' }, 1.07);
  tl.to(top, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, 1.07);
  tl.to(bottom, { yPercent: 100, duration: 1, ease: 'expo.inOut' }, 1.15);
  tl.call(onDone, [], 1.9);
}

/* ---------- Hero intro ---------- */
function heroIntro() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  heroStarted = true;
  if (isReduced) {
    gsap.set('.hero-photo-frame', { clipPath: 'inset(0% 0 0% 0)' });
    heroGL?.setReveal(1);
    return;
  }
  const first = new SplitText('.hero-name .line-1', { type: 'chars' });
  const last = new SplitText('.hero-name .line-2', { type: 'chars' });
  gsap.set([first.chars, last.chars], { yPercent: 110, rotateX: -70, opacity: 0, transformOrigin: '50% 100%' });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    [...first.chars, ...last.chars].forEach((char) => {
      char.addEventListener('pointerenter', () => {
        gsap.to(char, {
          yPercent: -6, duration: 0.35, ease: 'power3.out', overwrite: 'auto',
          onComplete: () => gsap.to(char, { yPercent: 0, duration: 0.35, ease: 'power3.out' }),
        });
      });
    });
  }
  const tl = gsap.timeline();
  if (!heroGL) tl.to('.hero-photo-frame', { clipPath: 'inset(0% 0 0% 0)', duration: 1.4, ease: 'expo.inOut' }, 0);
  tl.to(heroReveal, { value: 1, duration: 1.4, ease: 'expo.inOut', onUpdate: () => heroGL?.setReveal(heroReveal.value) }, 0)
    .to(first.chars, { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.035 }, 0.15)
    .to(last.chars, { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.035 }, 0.35)
    .from(['.hero-eyebrow', '.hero-intro', '.hero-tags', '.hero-ctas'], {
      yPercent: 60, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09,
    }, 0.6)
    .from('.hero-ticker', { opacity: 0, duration: 0.8 }, 1.0);
}

function initHeroGL() {
  const hero = document.querySelector<HTMLElement>('.hero');
  const frame = hero?.querySelector<HTMLElement>('.hero-photo-frame');
  const img = frame?.querySelector<HTMLImageElement>('img');
  if (!hero || !frame || !img || document.documentElement.classList.contains('no-gl')) return;
  let pageGone = false;
  const visibility = ScrollTrigger.create({
    trigger: hero, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { if (self.isActive) heroGL?.start(); else heroGL?.stop(); },
  });
  frame.addEventListener('hero-gllost', () => {
    heroGL = null;
    gsap.set(img, { scale: 1 + heroScroll * 0.12 });
    gsap.set(frame, { yPercent: 0, clipPath: `inset(0 0 ${(1 - heroReveal.value) * 100}% 0)` });
    if (heroStarted && !isReduced) gsap.to(frame, { clipPath: 'inset(0% 0 0% 0)', duration: (1 - heroReveal.value) * 1.4, ease: 'expo.inOut' });
  });
  window.addEventListener('pagehide', () => { pageGone = true; heroGL?.dispose(); heroGL = null; }, { once: true });
  void import('./hero-gl').then(({ createHeroGL }) => createHeroGL(frame, img)).then((result) => {
    if (!result) return;
    if (pageGone) { result.dispose(); return; }
    heroGL = result;
    result.setReveal(heroReveal.value);
    result.setScroll(heroScroll);
    gsap.killTweensOf(frame, 'clipPath');
    gsap.set(frame, { clipPath: 'inset(0% 0 0% 0)', yPercent: isReduced ? 0 : heroScroll * 10 });
    if (visibility.isActive) result.start();
    hero.classList.add('has-gl');
  }).catch(() => {
    hero.classList.remove('has-gl');
  });
}

/* ---------- Scroll animations ---------- */
function initScroll() {
  if (isReduced) {
    document.querySelectorAll('.mask-line > span').forEach((el) => ((el as HTMLElement).style.transform = 'none'));
    const ap = document.querySelector<HTMLElement>('.about-photo');
    if (ap) ap.style.clipPath = 'inset(0% 0 0% 0)';
    return;
  }
  const frame = document.querySelector<HTMLElement>('.hero-photo-frame')!;
  const heroImg = frame.querySelector<HTMLImageElement>('img')!;
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => {
      heroScroll = self.progress;
      if (heroGL) {
        heroGL.setScroll(heroScroll);
        gsap.set(frame, { yPercent: heroScroll * 10 });
      } else {
        gsap.set(heroImg, { scale: 1 + heroScroll * 0.12 });
      }
    },
  });
  gsap.to('.hero-name .line-1', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-name .line-2', { yPercent: -22, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-inner', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true } });

  // generic masked line reveals
  document.querySelectorAll<HTMLElement>('[data-reveal-lines]').forEach((el) => {
    const lines = el.querySelectorAll<HTMLElement>('.mask-line > span');
    if (!/^H[1-6]$/.test(el.tagName) && !el.closest('#about .sec-head')) {
      gsap.to(lines, { y: 0, yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 78%' } });
      return;
    }
    const isContact = el.classList.contains('contact-headline');
    const contactChars: HTMLElement[] = [];
    let remaining = lines.length;
    lines.forEach((line) => {
      gsap.set(line, { y: 0, yPercent: 0 });
      const split = new SplitText(line, { type: 'chars' });
      if (isContact) contactChars.push(...split.chars as HTMLElement[]);
      gsap.fromTo(split.chars, { yPercent: 110, rotateX: -55, opacity: 0, transformOrigin: '50% 100%' }, {
        yPercent: 0, rotateX: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.02,
        scrollTrigger: { trigger: el, start: 'top 78%' },
        onComplete: () => { if (isContact && --remaining === 0) el.classList.add('is-revealed'); },
      });
    });
    if (isContact && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      contactChars.forEach((char, i) => char.addEventListener('pointerenter', () => {
        if (!el.classList.contains('is-revealed')) return;
        contactChars.forEach((other, j) => gsap.to(other, {
          yPercent: -14 * Math.exp(-Math.abs(i - j) / 1.6), skewX: i === j ? -8 : 0,
          duration: .5, ease: 'power3.out', overwrite: 'auto',
        }));
      }));
      el.addEventListener('pointerleave', () => gsap.to(contactChars, {
        yPercent: 0, skewX: 0, duration: .8, ease: 'elastic.out(1,.6)', overwrite: 'auto',
      }));
    }
  });

  // about statement word-by-word fill
  const stmt = document.querySelector('.about-statement');
  if (stmt) {
    const words = new SplitText(stmt, { type: 'words' });
    gsap.fromTo(words.words, { opacity: 0.25 }, {
      opacity: 1,
      stagger: 0.05,
      ease: 'none',
      scrollTrigger: { trigger: stmt, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
    gsap.fromTo(words.words, { y: 10 }, {
      y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.02,
      scrollTrigger: { trigger: stmt, start: 'top 85%' },
    });
  }

  document.querySelectorAll<HTMLElement>('.ghost-index').forEach((ghost) => {
    const section = ghost.closest('section');
    if (!section) return;
    gsap.to(ghost, {
      yPercent: -14, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
  const interests = document.querySelector('.interest-list');
  if (interests) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: interests, start: 'top 85%' } });
    tl.from(interests.querySelectorAll('.i-line'), { scaleX: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 }, 0)
      .from(interests.querySelectorAll('.i-label'), { x: -14, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07 }, 0)
      .from(interests.querySelectorAll('.i-tag'), { opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07 }, 0.1);
  }
  const p2 = document.querySelector('.about-p2');
  if (p2) {
    new SplitText(p2, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (split) => gsap.from(split.lines, {
        yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: p2, start: 'top 82%' },
      }),
    });
    gsap.from('.traits', {
      y: 14, opacity: 0, duration: 0.8, delay: 0.2, ease: 'expo.out',
      scrollTrigger: { trigger: p2, start: 'top 82%' },
    });
  }

  const ap = document.querySelector<HTMLElement>('.about-photo');
  if (ap) {
    const img = ap.querySelector<HTMLImageElement>('img')!;
    const glare = ap.querySelector<HTMLElement>('.glare')!;
    const media = ap.querySelector<HTMLElement>('.about-media')!;
    gsap.fromTo(ap, { clipPath: 'inset(12% 8% 12% 8%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: ap, start: 'top 90%', end: 'top 30%', scrub: true },
    });
    gsap.fromTo(img, { scale: 1.28 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: ap, start: 'top 90%', end: 'top 30%', scrub: true },
    });
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: ap, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      gsap.set(ap, { transformPerspective: 1200 });
      const xTo = gsap.quickTo(ap, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(ap, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      media.addEventListener('pointermove', (event) => {
        const rect = media.getBoundingClientRect();
        const x = gsap.utils.clamp(0, 1, (event.clientX - rect.left) / rect.width);
        const y = gsap.utils.clamp(0, 1, (event.clientY - rect.top) / rect.height);
        xTo((0.5 - y) * 8);
        yTo((x - 0.5) * 8);
        glare.style.setProperty('--gx', `${x * 100}%`);
        glare.style.setProperty('--gy', `${y * 100}%`);
        gsap.to(glare, { opacity: 1, duration: 0.4, overwrite: true });
      });
      media.addEventListener('pointerleave', () => {
        gsap.to(ap, { rotationX: 0, rotationY: 0, duration: 0.8, ease: 'power3.out', overwrite: true });
        gsap.to(glare, { opacity: 0, duration: 0.8, ease: 'power3.out', overwrite: true });
      });
    }
  }

  const setters = [...document.querySelectorAll<HTMLElement>('[data-velocity-skew]')]
    .map((el) => gsap.quickSetter(el, 'skewY', 'deg'));
  let skew = 0;
  gsap.ticker.add(() => {
    const velocity = lenis?.velocity || 0;
    heroGL?.setVelocity(velocity);
    const next = skew + (gsap.utils.clamp(-4, 4, velocity * 0.12) - skew) * 0.12;
    if (Math.abs(next - skew) > 0.001) {
      skew = next;
      setters.forEach((set) => set(skew));
    }
  });
}

/* ---------- Header ---------- */
function initHeader() {
  const header = document.getElementById('siteHeader')!;
  const progress = document.getElementById('scrollProgress')!;
  let last = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      progress.style.transform = `scaleX(${self.progress})`;
      const y = window.scrollY;
      if (y > 120 && y > last + 4) header.classList.add('is-hidden');
      else if (y < last - 4 || y < 120) header.classList.remove('is-hidden');
      last = y;
    },
  });

  const burger = document.getElementById('burger')!;
  const menu = document.getElementById('mobileMenu')!;
  const setMenu = (open: boolean) => {
    menu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    if (open && !isReduced) {
      gsap.from(menu.querySelectorAll('a'), {
        yPercent: 110, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06,
      });
      (menu.querySelector('a') as HTMLElement)?.focus();
    }
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('open')) return;
    if (e.key === 'Escape') { setMenu(false); burger.focus(); }
    if (e.key === 'Tab') {
      const focusables = [burger, ...menu.querySelectorAll<HTMLElement>('a')];
      const first = focusables[0], last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
    }
  });
}

/* ---------- Contact extras ---------- */
function initContact() {
  const email = document.getElementById('emailLink');
  const toast = document.getElementById('copyToast');
  const emailText = email?.querySelector<HTMLElement>('.email-flip');
  let resetEmail: ReturnType<typeof setTimeout> | undefined;
  email?.addEventListener('click', (e) => {
    e.preventDefault();
    const address = email.dataset.email || '';
    navigator.clipboard?.writeText(address).catch(() => {});
    const flip = (value: string) => {
      if (!emailText) return;
      gsap.killTweensOf(emailText);
      if (isReduced) emailText.textContent = value;
      else gsap.to(emailText, { rotationX: 90, duration: .15, onComplete: () => {
        emailText.textContent = value;
        gsap.fromTo(emailText, { rotationX: -90 }, { rotationX: 0, duration: .15 });
      } });
    };
    flip(email.dataset.copied || '');
    if (toast) toast.textContent = email.dataset.copied || '';
    clearTimeout(resetEmail);
    resetEmail = setTimeout(() => { flip(address); if (toast) toast.textContent = ''; }, 1200);
  });

  const clock = document.getElementById('localTime');
  if (clock) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Europe/Bratislava',
    });
    const hours = clock.querySelector<HTMLElement>('.clock-hm')!;
    const roll = clock.querySelector<HTMLElement>('.clock-seconds-roll')!;
    const homeClock = document.querySelector<HTMLElement>('.home-clock');
    const first = formatter.format(new Date());
    hours.textContent = `${first.slice(0, 5)}:`;
    if (homeClock) homeClock.textContent = first.slice(0, 5);
    [...roll.children].forEach((el) => { el.textContent = first.slice(-2); });
    clock.setAttribute('aria-label', first);
    const setSeconds = createDigitRoll(roll, {
      initial: first.slice(-2), reduced: isReduced, accessible: clock,
      label: (seconds) => `${hours.textContent}${seconds}`,
    });
    const tick = () => {
      const value = formatter.format(new Date());
      hours.textContent = `${value.slice(0, 5)}:`;
      if (homeClock) homeClock.textContent = value.slice(0, 5);
      setSeconds(value.slice(-2));
      clock.setAttribute('aria-label', value);
    };
    setInterval(tick, 1000);
  }
  if (!isReduced) gsap.from('.footer-row > *', {
    y: 20, opacity: 0, duration: .8, ease: 'expo.out', stagger: .08,
    scrollTrigger: { trigger: '.contact-footer', start: 'top 95%' },
  });

  document.getElementById('backToTop')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(0, { duration: 2.6 });
    else window.scrollTo({ top: 0 });
  });
  initContactScene({ reduced: isReduced, lenis });
}

/* ---------- Boot ---------- */
/* ---------- Nav active state ---------- */
function initNavSpy() {
  const nav = document.querySelector<HTMLElement>('.desktop-nav')!;
  const ink = nav.querySelector<HTMLElement>('.nav-ink')!;
  const roll = document.querySelector<HTMLElement>('.hdr-roll')!;
  const index = document.querySelector<HTMLElement>('.hdr-index')!;
  const numbers: Record<string, string> = {
    about: '01', record: '02', work: '03', research: '04',
    summit: '05', skills: '06', experience: '07', contact: '08',
  };
  let active: HTMLAnchorElement | null = null, hovered: HTMLAnchorElement | null = null;
  const setIndex = createDigitRoll(roll, {
    initial: '01', reduced: isReduced, accessible: index, format: (value) => `${value} / 08`,
  });
  const moveInk = (link: HTMLAnchorElement | null) => {
    const values = { x: link?.offsetLeft || 0, width: link?.offsetWidth || 0 };
    if (isReduced) gsap.set(ink, values);
    else gsap.to(ink, { ...values, duration: 0.35, ease: 'power3.out', overwrite: true });
  };
  nav.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    link.addEventListener('pointerenter', () => { hovered = link; moveInk(link); });
    link.addEventListener('focus', () => { hovered = link; moveInk(link); });
    link.addEventListener('blur', () => { hovered = null; moveInk(active); });
  });
  nav.addEventListener('pointerleave', () => { hovered = null; moveInk(active); });
  window.addEventListener('resize', () => moveInk(hovered || active));
  document.querySelectorAll<HTMLElement>('section[id]').forEach((sec) => {
    if (!numbers[sec.id]) return;
    const link = nav.querySelector<HTMLAnchorElement>(`a[href="#${sec.id}"]`);
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: () => {
        const pin = ScrollTrigger.getAll().find((st) => st.pin && st.trigger === sec);
        return '+=' + (sec.offsetHeight + (pin ? pin.end - pin.start : 0));
      },
      refreshPriority: -1,
      onToggle: (self) => {
        link?.classList.toggle('nav-active', self.isActive);
        if (self.isActive) {
          setIndex(numbers[sec.id]);
          active = link;
          if (!hovered) moveInk(active);
        } else if (active === link) {
          active = null;
          if (!hovered) moveInk(null);
        }
      },
    });
  });
}

/* ---------- Boot ---------- */
runPreloader(heroIntro);
initHeroGL();
initRecord();
initWork();
initResearch();
initResearchCopy();
initSummit();
initSkills();
initExperience();
initThemeMorph();
initScroll();
initHeader();
initContact();
if (!isReduced) initMagnetic();
initNavSpy();
ScrollTrigger.sort();
ScrollTrigger.refresh();

// anchor links through Lenis
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target as HTMLElement, { duration: 1.4 });
    else target.scrollIntoView();
  });
});
