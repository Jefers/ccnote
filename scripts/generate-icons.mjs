
import sharp from 'sharp';
const sizes = [192, 512];
for (const size of sizes) {
  await sharp('public/icons/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  await sharp('public/icons/icon.svg')
    .resize(Math.round(size * 0.82), Math.round(size * 0.82))
    .extend({
      top: Math.round(size * 0.09),
      bottom: size - Math.round(size * 0.82) - Math.round(size * 0.09),
      left: Math.round(size * 0.09),
      right: size - Math.round(size * 0.82) - Math.round(size * 0.09),
      background: '#101820',
    })
    .png()
    .toFile(`public/icons/icon-${size}-maskable.png`);
}
await sharp('public/icons/icon.svg').resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
