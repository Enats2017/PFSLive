// Measures text in points with the app's own font files (the TTFs the app
// loads through @expo-google-fonts), from each glyph's advance width.
// Kerning is not applied; it only ever tightens Latin text a little, so a
// width from here is at most ~2% wider than what the phone draws.
//
//   const { textWidth } = require('./text-width.cjs');
//   textWidth('Deelnemers', 'Poppins_600SemiBold', 14)            // → points
//   textWidth('Live', 'Inter_600SemiBold', 13, { letterSpacing: 1.2, upper: true })
const fs = require('fs');
const path = require('path');

const FONT_DIR = {
  Inter_400Regular: 'inter/400Regular',
  Inter_500Medium: 'inter/500Medium',
  Inter_600SemiBold: 'inter/600SemiBold',
  Poppins_500Medium: 'poppins/500Medium',
  Poppins_600SemiBold: 'poppins/600SemiBold',
};
// fonts.* tokens in src/styles/common.styles.ts → file names
const TOKEN = {
  'fonts.body': 'Inter_400Regular',
  'fonts.bodyMedium': 'Inter_500Medium',
  'fonts.bodySemi': 'Inter_600SemiBold',
  'fonts.displayMedium': 'Poppins_500Medium',
  'fonts.display': 'Poppins_600SemiBold',
};

const cache = {};

const load = (name) => {
  if (cache[name]) return cache[name];
  const dir = FONT_DIR[name];
  if (!dir) throw new Error('unknown font ' + name);
  const b = fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@expo-google-fonts', dir, name + '.ttf'));
  const tables = {};
  const n = b.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    tables[b.toString('latin1', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const unitsPerEm = b.readUInt16BE(tables.head + 18);
  const numHMetrics = b.readUInt16BE(tables.hhea + 34);
  const advance = (gid) => b.readUInt16BE(tables.hmtx + 4 * Math.min(gid, numHMetrics - 1));

  // cmap: prefer format 12 (full Unicode), else format 4 (BMP).
  const cmap = tables.cmap;
  const subs = b.readUInt16BE(cmap + 2);
  let f4 = null;
  let f12 = null;
  for (let i = 0; i < subs; i++) {
    const off = cmap + b.readUInt32BE(cmap + 4 + i * 8 + 4);
    const fmt = b.readUInt16BE(off);
    if (fmt === 12) f12 = off;
    else if (fmt === 4) f4 = off;
  }
  const glyph = (cp) => {
    if (f12 !== null) {
      const groups = b.readUInt32BE(f12 + 12);
      for (let g = 0; g < groups; g++) {
        const o = f12 + 16 + g * 12;
        const s = b.readUInt32BE(o);
        const e = b.readUInt32BE(o + 4);
        if (cp >= s && cp <= e) return b.readUInt32BE(o + 8) + (cp - s);
      }
      return 0;
    }
    const segX2 = b.readUInt16BE(f4 + 6);
    const ends = f4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = b.readUInt16BE(ends + 2 * i);
      if (cp > end) continue;
      const start = b.readUInt16BE(starts + 2 * i);
      if (cp < start) return 0;
      const delta = b.readInt16BE(deltas + 2 * i);
      const ro = b.readUInt16BE(ranges + 2 * i);
      if (ro === 0) return (cp + delta) & 0xffff;
      const gi = b.readUInt16BE(ranges + 2 * i + ro + 2 * (cp - start));
      return gi === 0 ? 0 : (gi + delta) & 0xffff;
    }
    return 0;
  };
  cache[name] = { unitsPerEm, advance, glyph };
  return cache[name];
};

const textWidth = (text, font, size, { letterSpacing = 0, upper = false } = {}) => {
  const f = load(TOKEN[font] || font);
  const s = upper ? String(text).toLocaleUpperCase() : String(text);
  let units = 0;
  let chars = 0;
  for (const ch of s) {
    units += f.advance(f.glyph(ch.codePointAt(0)));
    chars++;
  }
  return (units / f.unitsPerEm) * size + letterSpacing * chars;
};

module.exports = { textWidth, TOKEN };
