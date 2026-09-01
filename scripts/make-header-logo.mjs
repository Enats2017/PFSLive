#!/usr/bin/env node
// Generates assets/livio_logo_header.png — the wordmark for the navy app header.
//
// The shipped `livio_logo_transparent.png` is a navy wordmark with a lime
// accent, which is invisible on the navy header bar. A flat tint would flatten
// the lime too, so this recolours only the dark pixels to white and leaves the
// lime accent alone.
//
//   node scripts/make-header-logo.mjs
//
// Re-run only if the source wordmark changes. The output is committed.
import sharp from 'sharp';

const SRC = 'assets/livio_logo_transparent.png';
const OUT = 'assets/livio_logo_header.png';

const { data, info } = await sharp(SRC)
  .raw()
  .ensureAlpha()
  .toBuffer({ resolveWithObject: true });

let recoloured = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 8) continue;                     // fully transparent
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  // The lime accent is the only bright, yellow-green pixel group — keep it.
  const isLime = r > 150 && g > 150 && b < 120;
  if (isLime) continue;
  data[i] = 255;
  data[i + 1] = 255;
  data[i + 2] = 255;
  recoloured++;
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(OUT);

console.log(`${OUT} written — ${recoloured} pixels recoloured to white, lime accent preserved`);
