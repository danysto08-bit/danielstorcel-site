const DEM_SIZE = 256;

export async function decodeDem(url: string): Promise<Float32Array> {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (image.naturalWidth !== DEM_SIZE || image.naturalHeight !== DEM_SIZE) throw new Error(`Invalid DEM size for ${url}`);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Cannot decode DEM image');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, DEM_SIZE, DEM_SIZE).data;
  const elevations = new Float32Array(DEM_SIZE * DEM_SIZE);
  for (let i = 0; i < elevations.length; i++) {
    const j = i * 4;
    elevations[i] = pixels[j] * 256 + pixels[j + 1] + pixels[j + 2] / 256 - 32768;
  }
  return elevations;
}
