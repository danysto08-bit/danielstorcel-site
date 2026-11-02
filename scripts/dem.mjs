import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const zoom = 13;
const size = 256;
const tileSize = 256;
const worldSize = tileSize * 2 ** zoom;
const output = fileURLToPath(new URL('../src/assets/dem/', import.meta.url));
const peaks = [
  { id: 'traunstein', lat: 47.8733, lon: 13.8367, boxKm: 7, summit: { lat: 47.8733, lon: 13.8367 }, known: 1691 },
  { id: 'gerlach', lat: 49.1644, lon: 20.1339, boxKm: 10, summit: { lat: 49.1644, lon: 20.1339 }, known: 2655 },
  { id: 'montblanc', lat: 45.8450, lon: 6.8350, boxKm: 14, summit: { lat: 45.8326, lon: 6.8652 }, known: 4808 },
];
const route = [
  { name: "Nid d'Aigle", lat: 45.8485, lon: 6.7820, known: 2372 },
  { name: 'Refuge de Tête Rousse', lat: 45.8508, lon: 6.8140, known: 3167 },
  { name: 'Refuge du Goûter', lat: 45.8505, lon: 6.8310, known: 3835 },
  { name: 'Dôme du Goûter', lat: 45.8427, lon: 6.8430, known: 4304 },
  { name: 'Refuge Vallot', lat: 45.8388, lon: 6.8512, known: 4362 },
  { name: 'Mont Blanc', lat: 45.8326, lon: 6.8652, known: 4808 },
];

function mercator(lat, lon) {
  const radians = lat * Math.PI / 180;
  return {
    x: (lon + 180) / 360 * worldSize,
    y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * worldSize,
  };
}

async function fetchTile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== tileSize || info.height !== tileSize) throw new Error(`${url}: invalid tile size`);
  const values = new Float32Array(tileSize * tileSize);
  for (let i = 0; i < values.length; i++) {
    const j = i * 4;
    values[i] = data[j] * 256 + data[j + 1] + data[j + 2] / 256 - 32768;
  }
  return { x, y, values };
}

async function generate(peak) {
  const center = mercator(peak.lat, peak.lon);
  const metresPerPixel = 156543.03 * Math.cos(peak.lat * Math.PI / 180) / 2 ** zoom;
  const span = peak.boxKm * 1000 / metresPerPixel;
  const left = center.x - span / 2;
  const top = center.y - span / 2;
  const firstX = Math.floor(left / tileSize), lastX = Math.floor((left + span) / tileSize);
  const firstY = Math.floor(top / tileSize), lastY = Math.floor((top + span) / tileSize);
  const tiles = [];
  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) tiles.push(fetchTile(x, y));
  }
  const loaded = await Promise.all(tiles);
  const width = (lastX - firstX + 1) * tileSize;
  const height = (lastY - firstY + 1) * tileSize;
  const stitched = new Float32Array(width * height);
  for (const tile of loaded) {
    const dx = (tile.x - firstX) * tileSize, dy = (tile.y - firstY) * tileSize;
    for (let y = 0; y < tileSize; y++) {
      stitched.set(tile.values.subarray(y * tileSize, (y + 1) * tileSize), (dy + y) * width + dx);
    }
  }
  const cropX = left - firstX * tileSize, cropY = top - firstY * tileSize;
  const step = span / size;
  const heights = new Int32Array(size * size);
  for (let row = 0; row < size; row++) {
    const y0 = cropY + row * step, y1 = y0 + step;
    for (let col = 0; col < size; col++) {
      const x0 = cropX + col * step, x1 = x0 + step;
      let sum = 0, weight = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          sum += stitched[y * width + x] * w;
          weight += w;
        }
      }
      heights[row * size + col] = Math.round(sum / weight);
    }
  }
  const sorted = [...heights].sort((a, b) => a - b);
  const gridPoint = (lat, lon) => {
    const point = mercator(lat, lon);
    return { col: (point.x - left) / span * size - .5, row: (point.y - top) / span * size - .5 };
  };
  const near = (point, metres, score) => {
    const radius = metres / (peak.boxKm * 1000 / size);
    let best = null, bestScore = Infinity;
    for (let row = Math.max(0, Math.ceil(point.row - radius)); row <= Math.min(size - 1, Math.floor(point.row + radius)); row++) {
      for (let col = Math.max(0, Math.ceil(point.col - radius)); col <= Math.min(size - 1, Math.floor(point.col + radius)); col++) {
        if (Math.hypot(col - point.col, row - point.row) > radius) continue;
        const elev = heights[row * size + col];
        const candidate = score(elev);
        if (candidate < bestScore) { bestScore = candidate; best = { col, row, elev }; }
      }
    }
    if (!best) throw new Error(`${peak.id}: no grid cells near ${JSON.stringify(point)}`);
    return best;
  };
  const summit = near(gridPoint(peak.summit.lat, peak.summit.lon), 600, (elev) => -elev);
  const metadata = {
    id: peak.id, lat: peak.lat, lon: peak.lon, boxKm: peak.boxKm,
    min: sorted[0], max: sorted.at(-1), base: sorted[Math.floor(sorted.length * .02)], summit,
  };
  if (peak.id === 'montblanc') {
    metadata.route = route.map((point) => {
      const grid = gridPoint(point.lat, point.lon);
      const col = Math.max(0, Math.min(size - 1, Math.round(grid.col)));
      const row = Math.max(0, Math.min(size - 1, Math.round(grid.row)));
      const original = { col, row, elev: heights[row * size + col] };
      const snapped = Math.abs(original.elev - point.known) > 150;
      const result = snapped ? near(grid, 300, (elev) => Math.abs(elev - point.known)) : original;
      return { name: point.name, lat: point.lat, lon: point.lon, known: point.known, ...result, snapped, originalElev: original.elev };
    });
  }
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < heights.length; i++) {
    const encoded = heights[i] + 32768;
    pixels[i * 3] = Math.floor(encoded / 256);
    pixels[i * 3 + 1] = encoded % 256;
    pixels[i * 3 + 2] = 0;
  }
  return { peak, metadata, pixels };
}

const results = await Promise.all(peaks.map(generate));
console.log('\nSummits (metres):');
console.table(results.map(({ peak, metadata }) => ({
  peak: peak.id, known: peak.known, DEM: metadata.summit.elev, difference: metadata.summit.elev - peak.known,
})));
console.log('\nGoûter route (metres):');
console.table(results[2].metadata.route.map((point) => ({
  name: point.name, known: point.known, DEM: point.elev, difference: point.elev - point.known,
  snap: point.snapped ? `yes (was ${point.originalElev})` : 'no',
})));
if (results.some(({ peak, metadata }) => Math.abs(metadata.summit.elev - peak.known) > 60)) {
  throw new Error('A summit DEM elevation differs from its known elevation by more than 60 m; no assets written.');
}
await mkdir(output, { recursive: true });
for (const { peak, pixels } of results) {
  const file = path.join(output, `${peak.id}.png`);
  await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file);
  console.log(`${peak.id}.png: ${(await stat(file)).size} bytes`);
}
await writeFile(path.join(output, 'dem.json'), `${JSON.stringify(results.map(({ metadata }) => metadata), null, 2)}\n`);
console.log(`dem.json: ${(await stat(path.join(output, 'dem.json'))).size} bytes`);
