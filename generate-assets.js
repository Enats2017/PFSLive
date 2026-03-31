// generate-assets.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE = 'assets/livio_logo.png';
const ASSETS_DIR = 'assets';

// ✅ Updated to match new navy logo background (sampled from image corners)
const NAVY_BG    = { r: 15,  g: 41,  b: 64,  alpha: 1 };
const WHITE_BG   = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0,  g: 0,   b: 0,   alpha: 0 };

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR);
}

console.log('🎨 Livio App - Asset Generator');
console.log('================================\n');

async function generateAssets() {
  try {
    // 1. Icon
    console.log('📱 Generating icon.png...');
    await sharp(SOURCE)
      .resize(1024, 1024, { fit: 'contain', background: NAVY_BG })
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('   ✅ Done\n');

    // 2. Adaptive Icon
    console.log('🎯 Generating adaptive-icon.png...');
    const adaptive = await sharp(SOURCE)
      .resize(768, 768, { fit: 'contain', background: TRANSPARENT })
      .toBuffer();

    await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: TRANSPARENT }
    })
      .composite([{ input: adaptive, top: 128, left: 128 }])
      .png()
      .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
    console.log('   ✅ Done\n');

    // 3. Splash - Navy
    console.log('💦 Generating splash-icon.png...');
    const splashNavy = await sharp(SOURCE)
      .resize(800, 800, { fit: 'contain', background: TRANSPARENT })
      .toBuffer();

    await sharp({
      create: { width: 1242, height: 2436, channels: 4, background: NAVY_BG }
    })
      .composite([{ input: splashNavy, gravity: 'center' }])
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
    console.log('   ✅ Done (navy background)\n');

    // 4. Splash - White
    console.log('💦 Generating splash-icon-white.png...');
    const splashWhite = await sharp(SOURCE)
      .resize(700, 700, { fit: 'contain', background: TRANSPARENT })
      .toBuffer();

    await sharp({
      create: { width: 1242, height: 2436, channels: 4, background: WHITE_BG }
    })
      .composite([{ input: splashWhite, gravity: 'center' }])
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash-icon-white.png'));
    console.log('   ✅ Done (white background)\n');

    // 5. Favicon
    console.log('🌐 Generating favicon.png...');
    await sharp(SOURCE)
      .resize(48, 48, { fit: 'contain', background: NAVY_BG })
      .png()
      .toFile(path.join(ASSETS_DIR, 'favicon.png'));
    console.log('   ✅ Done\n');

    // Summary
    console.log('✨ All assets generated!\n');
    console.log('Generated files:');

    const files = [
      'icon.png',
      'adaptive-icon.png',
      'splash-icon.png',
      'splash-icon-white.png',
      'favicon.png',
      'notification-icon.png',
    ];

    files.forEach(file => {
      const filePath = path.join(ASSETS_DIR, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`  ✅ ${file.padEnd(30)} (${(stats.size / 1024).toFixed(2)} KB)`);
      }
    });

    console.log('\n📋 Next steps:');
    console.log('  1. npx expo prebuild --clean');
    console.log('  2. eas build --profile development --platform android');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateAssets();