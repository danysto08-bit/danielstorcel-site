import type Lenis from 'lenis';
import { gsap } from '../motion';

type WeatherCodes = { clear: string; partly: string; cloudy: string; fog: string; drizzle: string; rain: string; snow: string; showers: string; storm: string };

function weatherDescription(code: number, labels: WeatherCodes) {
  if (code === 0) return labels.clear;
  if (code <= 2) return labels.partly;
  if (code === 3) return labels.cloudy;
  if (code === 45 || code === 48) return labels.fog;
  if (code >= 51 && code <= 57) return labels.drizzle;
  if (code >= 61 && code <= 67) return labels.rain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return labels.snow;
  if (code >= 80 && code <= 82) return labels.showers;
  if (code >= 95 && code <= 99) return labels.storm;
  return '';
}

async function loadWeather(element: HTMLElement) {
  let worker: Worker | undefined;
  try {
    worker = new Worker(new URL('./contact-weather.worker.ts', import.meta.url), { type: 'module' });
    const current = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Weather timeout')), 6500);
      worker!.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data) resolve(event.data);
        else reject(new Error('Weather unavailable'));
      };
      worker!.onerror = (event) => { event.preventDefault(); clearTimeout(timeout); reject(new Error('Weather unavailable')); };
      worker!.postMessage(null);
    });
    const temperature = current?.temperature_2m, wind = current?.wind_speed_10m, code = current?.weather_code;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || typeof wind !== 'number' || !Number.isFinite(wind) || typeof code !== 'number' || !Number.isFinite(code)) throw new Error('Invalid weather');
    const labels = JSON.parse(element.dataset.codes || '{}') as WeatherCodes;
    const description = weatherDescription(code, labels);
    if (!description) throw new Error('Unknown weather');
    element.textContent = `${element.dataset.label} · ${Math.round(temperature)} °C · ${element.dataset.wind} ${Math.round(wind)} km/h · ${description}`;
    element.hidden = false;
    element.dataset.state = 'loaded';
  } catch {
    element.hidden = true;
    element.dataset.state = 'unavailable';
  } finally {
    worker?.terminate();
  }
}

export function initContactScene({ reduced, lenis }: { reduced: boolean; lenis: Lenis | null }) {
  const section = document.querySelector<HTMLElement>('#contact');
  if (!section) return;
  const signpost = section.querySelector<HTMLElement>('.signpost')!;
  const weather = section.querySelector<HTMLElement>('.contact-weather')!;
  const slots = [...signpost.querySelectorAll<HTMLElement>('.plank-motion')];
  if (!reduced) {
    const direction = (element: HTMLElement) =>
      window.matchMedia('(max-width: 1023px)').matches || element.closest('.plank-row')?.classList.contains('is-right') ? 1 : -1;
    gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 70%', once: true } })
      .from('.signpost-shaft', { scaleY: 0, duration: .9, ease: 'power2.out' }, 0)
      .from('.signpost-cap, .signpost-ground', { opacity: 0, duration: .3 }, 0)
      .from(slots, { x: (_i: number, el: HTMLElement) => direction(el) * 40, rotation: (_i: number, el: HTMLElement) => direction(el) * -4, transformOrigin: (_i: number, el: HTMLElement) => direction(el) > 0 ? 'left center' : 'right center', duration: .65, stagger: .07, ease: 'expo.out' }, .9)
      .from('.plank-tag', { opacity: 0, duration: .35, stagger: .07 }, .95);
  }

  let weatherStarted = false, ticking = false, sway = 0;
  const tick = () => {
    const target = Math.max(-2, Math.min(2, (lenis?.velocity || 0) * .12));
    sway += (target - sway) * .1;
    signpost.style.setProperty('--sway', `${sway.toFixed(3)}deg`);
  };
  const observer = new IntersectionObserver((entries) => {
    const visible = entries[0].isIntersecting;
    if (visible && !weatherStarted) { weatherStarted = true; void loadWeather(weather); }
    if (!reduced && visible && !ticking) { ticking = true; gsap.ticker.add(tick); }
    else if (!visible && ticking) { ticking = false; gsap.ticker.remove(tick); }
  });
  observer.observe(section);
}
