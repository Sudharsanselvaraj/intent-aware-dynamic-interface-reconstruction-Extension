const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, 'src/assets/icon.svg');
const sizes = [16, 32, 48, 128];

async function generateIcons() {
  const svgBuffer = await sharp(svgPath).toBuffer();
  
  for (const size of sizes) {
    const outputPath = path.join(__dirname, `src/assets/icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created icon-${size}.png`);
  }
  
  console.log('All PNG icons generated!');
}

generateIcons().catch(console.error);