// extract-logo-shape.js
const sharp = require('sharp');
const fs = require('fs');

const SOURCE = 'assets/livio_logo.png';
const OUTPUT = 'assets/livio_logo_transparent.png';

console.log('🎨 Extracting logo shape from orange background...\n');

async function extractLogo() {
  try {
    // Load the image
    const image = sharp(SOURCE);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    console.log(`📊 Source: ${info.width}x${info.height}, ${info.channels} channels\n`);

    // Create new image data with transparency
    const newData = Buffer.alloc(info.width * info.height * 4);
    
    // Orange background color (approximately)
    const orangeR = 255;
    const orangeG = 87;
    const orangeB = 34;
    const tolerance = 50; // Color tolerance

    let removedPixels = 0;
    let keptPixels = 0;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate color difference from orange
      const diffR = Math.abs(r - orangeR);
      const diffG = Math.abs(g - orangeG);
      const diffB = Math.abs(b - orangeB);
      const totalDiff = diffR + diffG + diffB;

      const outIndex = (i / info.channels) * 4;

      // If pixel is orange (background), make it transparent
      if (totalDiff < tolerance) {
        newData[outIndex] = 0;     // R
        newData[outIndex + 1] = 0; // G
        newData[outIndex + 2] = 0; // B
        newData[outIndex + 3] = 0; // A (transparent)
        removedPixels++;
      } else {
        // Keep the pixel (it's part of the logo)
        newData[outIndex] = r;
        newData[outIndex + 1] = g;
        newData[outIndex + 2] = b;
        newData[outIndex + 3] = 255; // A (opaque)
        keptPixels++;
      }
    }

    console.log(`🔍 Processing results:`);
    console.log(`   - Orange pixels removed: ${removedPixels}`);
    console.log(`   - Logo pixels kept: ${keptPixels}\n`);

    // Save the transparent version
    await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toFile(OUTPUT);

    const stats = fs.statSync(OUTPUT);
    console.log(`✅ Transparent logo saved!`);
    console.log(`   File: ${OUTPUT}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

    console.log(`📋 Next steps:`);
    console.log(`   1. Open: https://romannurik.github.io/AndroidAssetStudio/icons-notification.html`);
    console.log(`   2. Upload: ${OUTPUT} (the transparent version)`);
    console.log(`   3. Download and extract the white notification icon`);
    console.log(`   4. Copy to: assets/notification-icon.png`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

extractLogo();