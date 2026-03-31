// extract-logo-shape.js
const sharp = require('sharp');
const fs = require('fs');

const SOURCE = 'assets/livio_logo.png';
const OUTPUT = 'assets/livio_logo_transparent.png';

console.log('🎨 Extracting logo shape from navy background...\n');

async function extractLogo() {
  try {
    const image = sharp(SOURCE);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    console.log(`📊 Source: ${info.width}x${info.height}, ${info.channels} channels\n`);

    const newData = Buffer.alloc(info.width * info.height * 4);

    // ✅ Updated to match new navy background (rgb 15, 41, 64)
    const bgR = 15;
    const bgG = 41;
    const bgB = 64;
    const tolerance = 40;

    let removedPixels = 0;
    let keptPixels = 0;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const totalDiff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      const outIndex = (i / info.channels) * 4;

      if (totalDiff < tolerance) {
        // Background pixel — make transparent
        newData[outIndex]     = 0;
        newData[outIndex + 1] = 0;
        newData[outIndex + 2] = 0;
        newData[outIndex + 3] = 0;
        removedPixels++;
      } else {
        // Logo pixel — keep as-is
        newData[outIndex]     = r;
        newData[outIndex + 1] = g;
        newData[outIndex + 2] = b;
        newData[outIndex + 3] = 255;
        keptPixels++;
      }
    }

    console.log('🔍 Processing results:');
    console.log(`   - Navy pixels removed: ${removedPixels}`);
    console.log(`   - Logo pixels kept:    ${keptPixels}\n`);

    await sharp(newData, {
      raw: { width: info.width, height: info.height, channels: 4 }
    })
      .png()
      .toFile(OUTPUT);

    const stats = fs.statSync(OUTPUT);
    console.log('✅ Transparent logo saved!');
    console.log(`   File: ${OUTPUT}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

    console.log('📋 Next steps:');
    console.log('   1. Open: https://romannurik.github.io/AndroidAssetStudio/icons-notification.html');
    console.log(`   2. Upload: ${OUTPUT} (the transparent version)`);
    console.log('   3. Download and extract the white notification icon');
    console.log('   4. Copy to: assets/notification-icon.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

extractLogo();