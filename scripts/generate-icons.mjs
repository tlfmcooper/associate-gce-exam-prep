import sharp from 'sharp';

async function generateIcons() {
  await sharp('public/icons/icon.svg')
    .resize(192, 192)
    .png()
    .toFile('public/icons/icon-192x192.png');
    
  await sharp('public/icons/icon.svg')
    .resize(512, 512)
    .png()
    .toFile('public/icons/icon-512x512.png');
    
  await sharp('public/icons/icon-maskable.svg')
    .resize(192, 192)
    .png()
    .toFile('public/icons/icon-maskable-192x192.png');
    
  await sharp('public/icons/icon-maskable.svg')
    .resize(512, 512)
    .png()
    .toFile('public/icons/icon-maskable-512x512.png');

  console.log('Icons generated successfully.');
}

generateIcons().catch(console.error);
