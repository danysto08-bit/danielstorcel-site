const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.8326&longitude=6.8652&elevation=4808&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh';
const scope = self as unknown as Worker;

scope.addEventListener('message', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(weatherUrl, { signal: controller.signal });
    if (!response.ok) throw new Error('Weather unavailable');
    const { current } = await response.json();
    scope.postMessage(current);
  } catch {
    scope.postMessage(null);
  } finally {
    clearTimeout(timeout);
  }
});

export {};
